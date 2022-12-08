/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMultiChild
 */

'use strict';

var ReactComponentEnvironment = require('ReactComponentEnvironment');
var ReactMultiChildUpdateTypes = require('ReactMultiChildUpdateTypes');

var ReactCurrentOwner = require('ReactCurrentOwner');
var ReactReconciler = require('ReactReconciler');
var ReactChildReconciler = require('ReactChildReconciler');

var flattenChildren = require('flattenChildren');
var invariant = require('invariant');

/**
 * Make an update for markup to be rendered and inserted at a supplied index.
 *
 * @param {string} markup Markup that renders into an element.
 * @param {number} toIndex Destination index.
 * @private
 */
function makeInsertMarkup(markup, afterNode, toIndex) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: ReactMultiChildUpdateTypes.INSERT_MARKUP,
    content: markup,
    fromIndex: null,
    fromNode: null,
    toIndex: toIndex,
    afterNode: afterNode,
  };
}

/**
 * Make an update for moving an existing element to another index.
 *
 * @param {number} fromIndex Source index of the existing element.
 * @param {number} toIndex Destination index of the element.
 * @private
 */
function makeMove(child, afterNode, toIndex) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: ReactMultiChildUpdateTypes.MOVE_EXISTING,
    content: null,
    fromIndex: child._mountIndex,
    fromNode: ReactReconciler.getNativeNode(child),
    toIndex: toIndex,
    afterNode: afterNode,
  };
}

/**
 * Make an update for removing an element at an index.
 *
 * @param {number} fromIndex Index of the element to remove.
 * @private
 */
function makeRemove(child, node) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: ReactMultiChildUpdateTypes.REMOVE_NODE,
    content: null,
    fromIndex: child._mountIndex,
    fromNode: node,
    toIndex: null,
    afterNode: null,
  };
}

/**
 * Make an update for setting the markup of a node.
 *
 * @param {string} markup Markup that renders into an element.
 * @private
 */
function makeSetMarkup(markup) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: ReactMultiChildUpdateTypes.SET_MARKUP,
    content: markup,
    fromIndex: null,
    fromNode: null,
    toIndex: null,
    afterNode: null,
  };
}

/**
 * Make an update for setting the text content.
 *
 * @param {string} textContent Text content to set.
 * @private
 */
function makeTextContent(textContent) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: ReactMultiChildUpdateTypes.TEXT_CONTENT,
    content: textContent,
    fromIndex: null,
    fromNode: null,
    toIndex: null,
    afterNode: null,
  };
}

/**
 * Push an update, if any, onto the queue. Creates a new queue if none is
 * passed and always returns the queue. Mutative.
 */
function enqueue(queue, update) {
  if (update) {
    queue = queue || [];
    queue.push(update);
  }
  return queue;
}

/**
 * Processes any enqueued updates.
 *
 * @private
 */
function processQueue(inst, updateQueue) {
  ReactComponentEnvironment.processChildrenUpdates(
    inst,
    updateQueue,
  );
}

/**
 * ReactMultiChild are capable of reconciling multiple children.
 *
 * @class ReactMultiChild
 * @internal
 */
var ReactMultiChild = {

  /**
   * Provides common functionality for components that must reconcile multiple
   * children. This is used by `ReactDOMComponent` to mount, update, and
   * unmount child components.
   *
   * @lends {ReactMultiChild.prototype}
   */
  Mixin: {
    
    /**
     * 会调用ReactChildReconciler模块的的instantiateChildren函数得到一个对象，对象中包含子节点初始化后的实例
     * @param {*} nestedChildren 子节点
     * @param {*} transaction    事务
     * @param {*} context        上下文
     * @returns 
     */
    _reconcilerInstantiateChildren: function(nestedChildren, transaction, context) {
      if (__DEV__) {
        if (this._currentElement) {
          try {
            ReactCurrentOwner.current = this._currentElement._owner;
            return ReactChildReconciler.instantiateChildren(
              nestedChildren, transaction, context
            );
          } finally {
            ReactCurrentOwner.current = null;
          }
        }
      }

      return ReactChildReconciler.instantiateChildren(
        nestedChildren, transaction, context
      );
    },

    _reconcilerUpdateChildren: function(
      prevChildren,
      nextNestedChildrenElements,
      removedNodes,
      transaction,
      context
    ) {
      var nextChildren;
      if (__DEV__) {
        if (this._currentElement) {
          try {
            ReactCurrentOwner.current = this._currentElement._owner;
            nextChildren = flattenChildren(nextNestedChildrenElements);
          } finally {
            ReactCurrentOwner.current = null;
          }
          ReactChildReconciler.updateChildren(
            prevChildren, nextChildren, removedNodes, transaction, context
          );
          return nextChildren;
        }
      }
      nextChildren = flattenChildren(nextNestedChildrenElements);
      ReactChildReconciler.updateChildren(
        prevChildren, nextChildren, removedNodes, transaction, context
      );
      return nextChildren;
    },

    /**
     * 为每个提供的子级生成一个“装载映像”。在这种情况下对于`ReactDOMComponent`，装载映像是一个标记字符串。
     *
     * @param {} nestedChildren   子节点
     * @param {} transaction      事务
     * @param {} context          上下文
     * @internal
     */
    mountChildren: function(nestedChildren, transaction, context) {

      /* 
          该函数会返回一个对象，该对象中包含子节点的信息
          子节点为react组件：
             {
               根据react组件的key属性生成的值: react组件初始化实例
             }
          
          子节点为数组
             {
                .0+: 文本组件的初始化实例，文本的话属性名会递增
                根据react组件的key属性生成的值: react组件初始化实例
                ...根据数组的长度来，以上面来填充
             }    
      
      */
      var children = this._reconcilerInstantiateChildren(
        nestedChildren, transaction, context
      );
      

      this._renderedChildren = children; // 将该对象存到组件初始化实例的_renderedChildren中
      var mountImages = []; // 声明一个数组
      var index = 0; // 声明一个索引

      // 遍历该对象
      for (var name in children) {
        
        // 判断对象中有没有该属性
        if (children.hasOwnProperty(name)) {

          var child = children[name]; // 将组件初始化的实例取出来

          /* 
              处理子节点，并返回一个lazyTree对象
          
          */
          var mountImage = ReactReconciler.mountComponent(
            child,  // 子节点组件初始化实例
            transaction,  // 事务
            this,  // 父节点组件初始化实例
            this._nativeContainerInfo,  // 集装信息，为一个对象，存储一些基础信息
            context // 上下文
          );
 


          child._mountIndex = index++; // 先当前初始化实例中存储索引
          mountImages.push(mountImage); // 将 lazyTree对象存到数组中
        }
      }
      return mountImages;  // 返回该数组
    },

    /**
     * Replaces any rendered children with a text content string.
     *
     * @param {string} nextContent String of content.
     * @internal
     */
    updateTextContent: function(nextContent) {
      var prevChildren = this._renderedChildren;
      // Remove any rendered children.
      ReactChildReconciler.unmountChildren(prevChildren, false);
      for (var name in prevChildren) {
        if (prevChildren.hasOwnProperty(name)) {
          invariant(false, 'updateTextContent called on non-empty component.');
        }
      }
      // Set new text content.
      var updates = [makeTextContent(nextContent)];
      processQueue(this, updates);
    },

    /**
     * Replaces any rendered children with a markup string.
     *
     * @param {string} nextMarkup String of markup.
     * @internal
     */
    updateMarkup: function(nextMarkup) {
      var prevChildren = this._renderedChildren;
      // Remove any rendered children.
      ReactChildReconciler.unmountChildren(prevChildren, false);
      for (var name in prevChildren) {
        if (prevChildren.hasOwnProperty(name)) {
          invariant(false, 'updateTextContent called on non-empty component.');
        }
      }
      var updates = [makeSetMarkup(nextMarkup)];
      processQueue(this, updates);
    },

    /**
     * Updates the rendered children with new children.
     *
     * @param {?object} nextNestedChildrenElements Nested child element maps.
     * @param {ReactReconcileTransaction} transaction
     * @internal
     */
    updateChildren: function(nextNestedChildrenElements, transaction, context) {
      // Hook used by React ART
      this._updateChildren(nextNestedChildrenElements, transaction, context);
    },

    /**
     * @param {?object} nextNestedChildrenElements Nested child element maps.
     * @param {ReactReconcileTransaction} transaction
     * @final
     * @protected
     */
    _updateChildren: function(nextNestedChildrenElements, transaction, context) {
      var prevChildren = this._renderedChildren;
      var removedNodes = {};
      var nextChildren = this._reconcilerUpdateChildren(
        prevChildren,
        nextNestedChildrenElements,
        removedNodes,
        transaction,
        context
      );
      if (!nextChildren && !prevChildren) {
        return;
      }
      var updates = null;
      var name;
      // `nextIndex` will increment for each child in `nextChildren`, but
      // `lastIndex` will be the last index visited in `prevChildren`.
      var lastIndex = 0;
      var nextIndex = 0;
      var lastPlacedNode = null;
      for (name in nextChildren) {
        if (!nextChildren.hasOwnProperty(name)) {
          continue;
        }
        var prevChild = prevChildren && prevChildren[name];
        var nextChild = nextChildren[name];
        if (prevChild === nextChild) {
          updates = enqueue(
            updates,
            this.moveChild(prevChild, lastPlacedNode, nextIndex, lastIndex)
          );
          lastIndex = Math.max(prevChild._mountIndex, lastIndex);
          prevChild._mountIndex = nextIndex;
        } else {
          if (prevChild) {
            // Update `lastIndex` before `_mountIndex` gets unset by unmounting.
            lastIndex = Math.max(prevChild._mountIndex, lastIndex);
            // The `removedNodes` loop below will actually remove the child.
          }
          // The child must be instantiated before it's mounted.
          updates = enqueue(
            updates,
            this._mountChildAtIndex(
              nextChild,
              lastPlacedNode,
              nextIndex,
              transaction,
              context
            )
          );
        }
        nextIndex++;
        lastPlacedNode = ReactReconciler.getNativeNode(nextChild);
      }
      // Remove children that are no longer present.
      for (name in removedNodes) {
        if (removedNodes.hasOwnProperty(name)) {
          updates = enqueue(
            updates,
            this._unmountChild(prevChildren[name], removedNodes[name])
          );
        }
      }
      if (updates) {
        processQueue(this, updates);
      }
      this._renderedChildren = nextChildren;
    },

    /**
     * Unmounts all rendered children. This should be used to clean up children
     * when this component is unmounted. It does not actually perform any
     * backend operations.
     *
     * @internal
     */
    unmountChildren: function(safely) {
      var renderedChildren = this._renderedChildren;
      ReactChildReconciler.unmountChildren(renderedChildren, safely);
      this._renderedChildren = null;
    },

    /**
     * Moves a child component to the supplied index.
     *
     * @param {ReactComponent} child Component to move.
     * @param {number} toIndex Destination index of the element.
     * @param {number} lastIndex Last index visited of the siblings of `child`.
     * @protected
     */
    moveChild: function(child, afterNode, toIndex, lastIndex) {
      // If the index of `child` is less than `lastIndex`, then it needs to
      // be moved. Otherwise, we do not need to move it because a child will be
      // inserted or moved before `child`.
      if (child._mountIndex < lastIndex) {
        return makeMove(child, afterNode, toIndex);
      }
    },

    /**
     * Creates a child component.
     *
     * @param {ReactComponent} child Component to create.
     * @param {string} mountImage Markup to insert.
     * @protected
     */
    createChild: function(child, afterNode, mountImage) {
      return makeInsertMarkup(mountImage, afterNode, child._mountIndex);
    },

    /**
     * Removes a child component.
     *
     * @param {ReactComponent} child Child to remove.
     * @protected
     */
    removeChild: function(child, node) {
      return makeRemove(child, node);
    },

    /**
     * Mounts a child with the supplied name.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to mount.
     * @param {string} name Name of the child.
     * @param {number} index Index at which to insert the child.
     * @param {ReactReconcileTransaction} transaction
     * @private
     */
    _mountChildAtIndex: function(
      child,
      afterNode,
      index,
      transaction,
      context) {
      var mountImage = ReactReconciler.mountComponent(
        child,
        transaction,
        this,
        this._nativeContainerInfo,
        context
      );
      child._mountIndex = index;
      return this.createChild(child, afterNode, mountImage);
    },

    /**
     * Unmounts a rendered child.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to unmount.
     * @private
     */
    _unmountChild: function(child, node) {
      var update = this.removeChild(child, node);
      child._mountIndex = null;
      return update;
    },

  },

};

module.exports = ReactMultiChild;
