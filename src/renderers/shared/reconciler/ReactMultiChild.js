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
 * 
 * @param {*} markup     新组件的lazyTree对象
 * @param {*} afterNode  上一次组件对应的dom标签
 * @param {*} toIndex    新组件的位置
 * @returns 
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
};



/**
 * 为将现有元素移动到另一个索引进行更新。
 *
 * @param {number} fromIndex 现有元素的源索引。
 * @param {number} toIndex 元素的目标索引。
 * @private
 */
function makeMove(child, afterNode, toIndex) {
  // 注意：空值减少隐藏类。
  return { 
    type: ReactMultiChildUpdateTypes.MOVE_EXISTING,  // 为 MOVE_EXISTING字符串
    content: null,
    fromIndex: child._mountIndex,  // 当前组件旧的索引
    fromNode: ReactReconciler.getNativeNode(child),  // 当前组件对应的dom节点
    toIndex: toIndex,  // 目标位的索引
    afterNode: afterNode,  // 上一个的dom节点
  };
};



/**
 * 
 * @param {*} child 虚拟dom
 * @param {*} node  dom标签
 * @returns 
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
 * 将更新（如果有）推送到队列中。如果没有，则创建新队列传递并始终返回队列。突变型。
 */
function enqueue(queue, update) {
  if (update) {
    queue = queue || [];
    queue.push(update); // 添加 将要互相替换位置的节点的信息对象
  }
  return queue;
}


/**
 * 
 * @param {*} inst  组件初始化实例 
 * @param {*} updateQueue  数组
 */
function processQueue(inst, updateQueue) {

  /* 
      processChildrenUpdates函数为ReactDOMIDOperations模块的dangerouslyProcessChildrenUpdates函数
  
  */
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
    

      return ReactChildReconciler.instantiateChildren(
        nestedChildren, transaction, context
      );
    },


    /**
     * 更新处理children
     * @param {*} prevChildren   一个对象，对象中存储子节点初始化的实例
     * @param {*} nextNestedChildrenElements  新children，数组
     * @param {*} removedNodes    空对象，存储要卸载的dom节点
     * @param {*} transaction     事务
     * @param {*} context         上下文
     * @returns 
     */
    _reconcilerUpdateChildren: function(
      prevChildren,
      nextNestedChildrenElements,
      removedNodes,
      transaction,
      context
    ) {

      var nextChildren; // 声明一个变量


      // 生成一个对象，如 {[name]: babel转义后的组件, 0: 文本, ...}
      nextChildren = flattenChildren(nextNestedChildrenElements);

      /* 
           该函数执行后nextChildren对象将会被修改成 {[name]: 组件初始化的实例, ...}
      */
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


          child._mountIndex = index++; // 先向当前初始化实例中存储顺序索引
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
     * 使用新的子对象更新渲染的子对象。
     * 更新children
     * @param {?object} nextNestedChildrenElements 新的children
     * @param {ReactReconcileTransaction} transaction 事务
     * @internal
     */
    updateChildren: function(nextNestedChildrenElements, transaction, context) {
      
      // 更新children
      this._updateChildren(nextNestedChildrenElements, transaction, context);
    },




    /**
     * 更新children
     * @param {*} nextNestedChildrenElements    新children
     * @param {*} transaction                   事务
     * @param {*} context                       上下文
     * @returns 
     */
    _updateChildren: function(nextNestedChildrenElements, transaction, context) {

      // 获取旧的children，但是是被处理的对象，对象中包含子节点初始化实例
      var prevChildren = this._renderedChildren;  

      var removedNodes = {};  // 声明一个对象，该对象会注入要卸载的dom节点

      /* 
         更新处理children
         该函数会返回一个对象，对象中包含子节点初始化的实例，跟prevChildren一样的对象
      */
      var nextChildren = this._reconcilerUpdateChildren(
        prevChildren,   // 一个对象，对象中包含子节点初始化的实例
        nextNestedChildrenElements,  // 新children
        removedNodes,  // 空对象
        transaction,   // 事务
        context        // 上下文
      );


      // 判断 新旧children 是否都没有值
      if (!nextChildren && !prevChildren) {
        return;
      };


      var updates = null;
      var name;

      // `nextIndex`将为“nextChildren”中的每个子级递增，但是
      // `lastIndex”将是“prevChildren”中访问的最后一个索引。
      var lastIndex = 0; // 最终会更新成children数组的最后一项的索引
      var nextIndex = 0; // 会递增，表示该项在children数组中的索引
      var lastPlacedNode = null; // 上一个的组件初始化实例的对应dom节点


      // 遍历新对象
      for (name in nextChildren) {

        // 如果对象中没有该属性则越过本次循环
        if (!nextChildren.hasOwnProperty(name)) {
          continue;
        };


        var prevChild = prevChildren && prevChildren[name]; // 获取旧对象中的该属性（组件初始化实例）

        var nextChild = nextChildren[name]; // 获取新对象中的该属性（组件初始化实例）

        if (prevChild === nextChild) {
         // 同一个引用，说明是使用的同一个component,所以我们需要做移动的操作
         // 移动已有的子节点
         // NOTICE：这里根据nextIndex, lastIndex决定是否移动

          // 如果需要节点替换位置，则返回一个数组，数组每一项为对象
          updates = enqueue(
            updates,

            // 参数为  子组件初始化实例、 上一个组件的dom节点、下一个索引、最后一个索引
            this.moveChild(prevChild, lastPlacedNode, nextIndex, lastIndex)
          );

          lastIndex = Math.max(prevChild._mountIndex, lastIndex);  // 返回最大那个参数

          /* 
            对组件初始化实例存储着在children数组中的索引为进行替换
            相当于会移动节点
          */
          prevChild._mountIndex = nextIndex; 
        } else {
          if (prevChild) {

            // 在卸载`_mountIndex`之前更新`lastIndex`。
            lastIndex = Math.max(prevChild._mountIndex, lastIndex); // 返回最大的那个参数
            // 下面的“removedNodes”循环实际上会删除子节点。

          }

          //子级必须在装入之前实例化。
          updates = enqueue(
            updates,
            this._mountChildAtIndex(
              nextChild,   // 新子节点初始化实例
              lastPlacedNode,  // 上一次，组件初始化实例对应的dom节点
              nextIndex,    // 该组件在children数组中的索引
              transaction,  // 事务
              context       // 上下文
            ) // _mountChildAtIndex函数会创建并返回一个信息对象
          );
        };


        nextIndex++; // 索引加加

        lastPlacedNode = ReactReconciler.getNativeNode(nextChild); // 获取该组件初始化实例对应的dom节点
      }



      // 删除不再存在的子项
      for (name in removedNodes) {
        if (removedNodes.hasOwnProperty(name)) {

          updates = enqueue(
            updates,

            /* 
                参数为 对应旧的初始化实例、dom节点
            */
            this._unmountChild(prevChildren[name], removedNodes[name]) // 创建一个信息对象并返回
          );

        }
      };
      

      // 如果需要移动，会对节点进行移动
      if (updates) {
        processQueue(this, updates);
      };
      this._renderedChildren = nextChildren; // 将新 装载映对象 赋值到组件初始化实例中

      // 来到这里时，代表更新完毕
    },

    

    /**
     * 卸载所有渲染的子级。这应该用来清理孩子当卸载此组件时。它实际上不执行任何后端操作。
     * @param {Boolean} safely   布尔值 
     */
    unmountChildren: function(safely) {

      /* 
           获取该节点下的子节点
           该属性为一个对象：{[name]: 组件初始化实例, ...}
      
      */
      var renderedChildren = this._renderedChildren; 


      // 参数为 子节点、布尔值
      ReactChildReconciler.unmountChildren(renderedChildren, safely);


      this._renderedChildren = null; // 将该存储子节点的属性置为空
    },

   

    /**
     * 将子组件移动到提供的索引。
     * @param {*} child          子组件初始化实例
     * @param {*} afterNode      上一个组件的dom节点
     * @param {*} toIndex        下一个索引
     * @param {*} lastIndex      最后一个索引
     * @returns 
     */
    moveChild: function(child, afterNode, toIndex, lastIndex) {
      /* 
         如果“child”的索引小于“lastIndex”，则需要移动。否则，我们不需要移动它，因为孩子会在“child”之前插入或移动

         满足两个条件方可移动
          1. prevChild === nextChild，这个条件是必然的，因为在之前reconcile的时候我们就已经把prevChild更新为nextChild了，除非nextChild是全新节点或者删除节点的情况。
          2. child._mountIndex < lastIndex。这个条件就值得思考一下了。
        
      */
      if (child._mountIndex < lastIndex) {



        /*  
            构建一个两个节点交换位置的信息对象
            
            参数为  子组件初始化实例、上一个组件的dom节点、下一个索引
        */
        return makeMove(child, afterNode, toIndex);
      }
    },

    /**
     * 
     * @param {*} child  组件初始化实例
     * @param {*} afterNode 上一次组件对应的dom标签
     * @param {*} mountImage 新组件lazyTree对象
     * @returns 
     */
    createChild: function(child, afterNode, mountImage) {
      return makeInsertMarkup(mountImage, afterNode, child._mountIndex);
    },

   
    /**
     * 
     * @param {*} child 虚拟dom
     * @param {*} node  dom标签
     * @returns 
     */
    removeChild: function(child, node) {
      return makeRemove(child, node);
    },

    

    /**
     * 渲染新组件
     * @param {*} child      新子节点初始化实例
     * @param {*} afterNode  上一次，组件初始化实例对应的dom节点
     * @param {*} index      该组件在children数组中的索引
     * @param {*} transaction  事务
     * @param {*} context      上下文
     * @returns 
     */
    _mountChildAtIndex: function(
      child,
      afterNode,
      index,
      transaction,
      context) {
      
      // 渲染组件
      var mountImage = ReactReconciler.mountComponent(
        child,  // 组件初始化实例
        transaction,  // 事务
        this,   // 父级组件初始化实例
        this._nativeContainerInfo,  // 集装信息
        context  // 上下文
      );
      child._mountIndex = index; // 该节点在数组中的目标位置

      return this.createChild(child, afterNode, mountImage); // 返回一个信息对象
    },

    

    /**
     * 卸载渲染的子级。
     * @param {*} child    组件初始化实例
     * @param {*} node     dom节点
     * @returns 
     */
    _unmountChild: function(child, node) {
      var update = this.removeChild(child, node);  // 返回一个信息对象
      child._mountIndex = null; // 将索引置为null
      return update;
    },

  },

};

module.exports = ReactMultiChild;
