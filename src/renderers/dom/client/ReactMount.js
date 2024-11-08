/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMount
 */

'use strict';

var DOMLazyTree = require('DOMLazyTree');
var DOMProperty = require('DOMProperty');
var ReactBrowserEventEmitter = require('ReactBrowserEventEmitter');
var ReactCurrentOwner = require('ReactCurrentOwner');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var ReactDOMContainerInfo = require('ReactDOMContainerInfo');
var ReactDOMFeatureFlags = require('ReactDOMFeatureFlags');
var ReactElement = require('ReactElement');
var ReactFeatureFlags = require('ReactFeatureFlags');
var ReactInstrumentation = require('ReactInstrumentation');
var ReactMarkupChecksum = require('ReactMarkupChecksum');
var ReactPerf = require('ReactPerf');
var ReactReconciler = require('ReactReconciler');
var ReactUpdateQueue = require('ReactUpdateQueue');
var ReactUpdates = require('ReactUpdates');

var emptyObject = require('emptyObject');
var instantiateReactComponent = require('instantiateReactComponent');
var invariant = require('invariant');
var setInnerHTML = require('setInnerHTML');
var shouldUpdateReactComponent = require('shouldUpdateReactComponent');
var warning = require('warning');

var ATTR_NAME = DOMProperty.ID_ATTRIBUTE_NAME; // 为  data-reactid
var ROOT_ATTR_NAME = DOMProperty.ROOT_ATTRIBUTE_NAME; // 为 data-reactroot

var ELEMENT_NODE_TYPE = 1;
var DOC_NODE_TYPE = 9;
var DOCUMENT_FRAGMENT_NODE_TYPE = 11;

var instancesByReactRootID = {};

/**
 * Finds the index of the first character
 * that's not common between the two given strings.
 *
 * @return {number} the index of the character where the strings diverge
 */
function firstDifferenceIndex(string1, string2) {
  var minLen = Math.min(string1.length, string2.length);
  for (var i = 0; i < minLen; i++) {
    if (string1.charAt(i) !== string2.charAt(i)) {
      return i;
    }
  }
  return string1.length === string2.length ? -1 : minLen;
}

/**
 * 判断容器节点类型
 * @param {DOMElement|DOMDocument} container 容器
 * a React component
 * @return {?*} 如果容器节点是document文档则返回html节点，否则返回容器的第一个子节点
 */
function getReactRootElementInContainer(container) {

  // 如果没有容器，则直接返回null
  if (!container) {
    return null;
  }

  /* 
      判断该容器的节点类型   
      元素节点值为              1
      属性节点值为              2
      文本节点值为              3
      注释节点值为              8
      document文本节点值为      9
      documentType节点值为      10
      documentFragment节点值为  11
  */
  if (container.nodeType === DOC_NODE_TYPE) { // 如果该容器节点是document文档，那么直接返回html节点
    return container.documentElement;
  } else {
    return container.firstChild;  // 否则返回该容器的第一个子节点
  }
}

function internalGetID(node) {

  /* 
     判断该节点有没有该函数如果有则执行该函数，参数为data-reactid
  */
  return node.getAttribute && node.getAttribute(ATTR_NAME) || '';
};


/**
 * 装载此组件并将其插入DOM。
 * 首次执行时this为null
 *
 * @param {ReactComponent} componentInstance 组件初始化的实例
 * @param {DOMElement} container 要装入的DOM元素
 * @param {ReactReconcileTransaction} transaction  事务
 * @param {boolean} shouldReuseMarkup 如果为true，则不插入标记
 */
function mountComponentIntoNode(
  wrapperInstance,
  container,
  transaction,
  shouldReuseMarkup,
  context
) {
  var markerName;

  // 首次执行时该属性为false
  if (ReactFeatureFlags.logTopLevelRenders) {
    var wrappedElement = wrapperInstance._currentElement.props;
    var type = wrappedElement.type;
    markerName = 'React mount: ' + (
      typeof type === 'string' ? type :
      type.displayName || type.name
    );
    console.time(markerName);
  }


  // 返回一个lazyTree对象
  var markup = ReactReconciler.mountComponent(
    wrapperInstance,  // 组件初始化的实例
    transaction, // 事务
    null,
    ReactDOMContainerInfo(wrapperInstance, container), //集装信息，主要存储容器和包装后的根组件的一些信息
    context // 上下文
  );


  if (markerName) {
    console.timeEnd(markerName);
  }

  //在组件初始化实例中添加_topLevelWrapper属性，值为包装层的组件初始化实例
  wrapperInstance._renderedComponent._topLevelWrapper = wrapperInstance;

  ReactMount._mountImageIntoNode(
    markup,             // 一整科节点树渲染后的对象  lazyTree对象
    container,          // 容器
    wrapperInstance,    // 组件初始化实例
    shouldReuseMarkup,  // 首次为false
    transaction         // 事务
  );
}





/**
 * 首次时该函数的this为null
 *
 * @param {ReactComponent} componentInstance 组件初始化的实例
 * @param {DOMElement} container 容器
 * @param {boolean} shouldReuseMarkup 如果为true，则不插入标记
 */
function batchedMountComponentIntoNode(
  componentInstance,
  container,
  shouldReuseMarkup, 
  context  // 上下文
) {

  /* 
        创建事务
        首次执行时最终会 new ReactReconcileTransaction 这个函数，并传一个true进去
         
        该事务拥有以下属性
          transactionWrappers为ReactReconcileTransaction模块的TRANSACTION_WRAPPERS事务数组
          wrapperInitData为空数组
          _isInTransaction为false
          renderToStaticMarkup为false
          reactMountReady为 new CallbackQueue 得到的实例对象
          useCreateElement为执行getPooled时传递的参数
          以及原型上的Transaction模块的属性
  
  */
  var transaction = ReactUpdates.ReactReconcileTransaction.getPooled(
    !shouldReuseMarkup && ReactDOMFeatureFlags.useCreateElement // ReactDOMFeatureFlags.useCreateElement为true
  );
  
  // 再次执行事务, 事务原型上的perform方法
  transaction.perform(
    mountComponentIntoNode,
    null,
    componentInstance, // 组件初始化的实例
    container,  // 容器
    transaction,  // 事务
    shouldReuseMarkup,  // 布尔值
    context // 上下文
  );

  
  ReactUpdates.ReactReconcileTransaction.release(transaction);
}




/**
 * Unmounts a component and removes it from the DOM.
 *
 * @param {ReactComponent} instance React component instance.
 * @param {DOMElement} container DOM element to unmount from.
 * @final
 * @internal
 * @see {ReactMount.unmountComponentAtNode}
 */
function unmountComponentFromNode(instance, container, safely) {
  ReactReconciler.unmountComponent(instance, safely);

  if (container.nodeType === DOC_NODE_TYPE) {
    container = container.documentElement;
  }

  // http://jsperf.com/emptying-a-node
  while (container.lastChild) {
    container.removeChild(container.lastChild);
  }
}

/**
 * 如果提供的DOM节点具有直接反应呈现的子节点，则为True，即不是React根元素。用于“渲染”中的警告，`卸载组件AtNode‘，等等。
 * @param {*} container 容器
 * @returns 
 */
function hasNonRootReactChild(container) {

   // 判断节点的类型, 参数是document,则返回html节点，否则返回参数的第一个子节点
  var rootEl = getReactRootElementInContainer(container);

  // 判断是否有值
  if (rootEl) {
    var inst = ReactDOMComponentTree.getInstanceFromNode(rootEl); // 获取组件初始化实例

    // 根react节点，根节点_nativeParent属性为null
    return !!(inst && inst._nativeParent); 
  }
}


/**
 * 获取出生根实例容器
 * @param {*} container   容器
 * @returns 
 */
function getNativeRootInstanceInContainer(container) {

  /* 
      判断容器节点的类型，做出相应的返回
      如果容器是document文档，则返回html节点，否则返回容器的第一个子节点
  
  */
  var rootEl = getReactRootElementInContainer(container); 

  /* 
       getInstanceFromNode的操作
  寻找rootEl节点及以上有internalInstanceKey属性的节点并返回，如果到最顶层没有，则返回null
  
  */
  var prevNativeInstance = rootEl && ReactDOMComponentTree.getInstanceFromNode(rootEl);


  // 因为最高层的react元素_nativeParent为null, 所以取反
  return (prevNativeInstance && !prevNativeInstance._nativeParent ? prevNativeInstance : null);

}


/**
 * 判断之前是否渲染过此元素，如果有则返回元素，如果没有则返回null
 * @param {*} container 容器
 * @returns 
 */
function getTopLevelWrapperInContainer(container) {

  // 获取旧的根组件（容器的下一级），没有则返回null，有则返回根组件初始化实例
  var root = getNativeRootInstanceInContainer(container);

  return root ? root._nativeContainerInfo._topLevelWrapper : null;
}

/**
 * Temporary (?) hack so that we can store all top-level pending updates on
 * composites instead of having to worry about different types of components
 * here.
 */
var topLevelRootCounter = 1;

var TopLevelWrapper = function() {
  this.rootID = topLevelRootCounter++;
};

TopLevelWrapper.prototype.isReactComponent = {};

if (__DEV__) {
  TopLevelWrapper.displayName = 'TopLevelWrapper';
}

TopLevelWrapper.prototype.render = function() {
  // this.props is actually a ReactElement
  return this.props;
};

/**
 * Mounting is the process of initializing a React component by creating its
 * representative DOM elements and inserting them into a supplied `container`.
 * Any prior content inside `container` is destroyed in the process.
 *
 *   ReactMount.render(
 *     component,
 *     document.getElementById('container')
 *   );
 *
 *   <div id="container">                   <-- Supplied `container`.
 *     <div data-reactid=".3">              <-- Rendered reactRoot of React
 *       // ...                                 component.
 *     </div>
 *   </div>
 *
 * Inside of `container`, the first element rendered is the "reactRoot".
 */
var ReactMount = {

  TopLevelWrapper: TopLevelWrapper,

  /**
   * Used by devtools. The keys are not important.
   */
  _instancesByReactRootID: instancesByReactRootID,

  /**
   * This is a hook provided to support rendering React components while
   * ensuring that the apparent scroll position of its `container` does not
   * change.
   *
   * @param {DOMElement} container The `container` being rendered into.
   * @param {function} renderCallback This must be called once to do the render.
   */
  scrollMonitor: function(container, renderCallback) {
    renderCallback();
  },

  /**
   * Take a component that's already mounted into the DOM and replace its props
   * @param {ReactComponent} prevComponent component instance already in the DOM
   * @param {ReactElement} nextElement component instance to render
   * @param {DOMElement} container container to render into
   * @param {?function} callback function triggered on completion
   */
  _updateRootComponent: function(
      prevComponent,
      nextElement,
      container,
      callback) {
    ReactMount.scrollMonitor(container, function() {
      ReactUpdateQueue.enqueueElementInternal(prevComponent, nextElement);
      if (callback) {
        ReactUpdateQueue.enqueueCallbackInternal(prevComponent, callback);
      }
    });

    return prevComponent;
  },



  /**
   * 将新组件呈现到DOM中。
   *
   * @param {ReactElement} nextElement 要渲染的元素,该元素是经过进一层封装过的
   * @param {DOMElement} container 要渲染到的容器
   * @param {boolean} shouldReuseMarkup 是否跳过该标记插入
   * @param {Object} context  上下文
   * @return {ReactComponent} nextComponent 返回一个渲染后的组件
   */
  _renderNewRootComponent: function(
    nextElement,
    container,
    shouldReuseMarkup,
    context
  ) {


    ReactBrowserEventEmitter.ensureScrollValueMonitoring(); //侦听窗口滚动和调整大小事件


    /* 
        nextElement 为要渲染的元素,该元素是经过进一层封装过的

        componentInstance为 new ReactCompositeComponentWrapper函数返回的实例，
        该函数中会执行ReactCompositeComponen模块的construct函数进行初始化
    
    */
    var componentInstance = instantiateReactComponent(nextElement); 



    // 执行事务
    ReactUpdates.batchedUpdates(
      batchedMountComponentIntoNode,  // 处理函数
      componentInstance,  // 组件初始化实例
      container,  // 要渲染到的容器
      shouldReuseMarkup, // 是否越过该标记插入
      context  // 首次渲染时context为emptyObject
    );

    var wrapperID = componentInstance._instance.rootID;
    instancesByReactRootID[wrapperID] = componentInstance;

   

    return componentInstance; // 外层实例
  },




  /**
   * Renders a React component into the DOM in the supplied `container`.
   *
   * If the React component was previously rendered into `container`, this will
   * perform an update on it and only mutate the DOM as necessary to reflect the
   * latest React component.
   *
   * @param {ReactComponent} parentComponent The conceptual parent of this render tree.
   * @param {ReactElement} nextElement Component element to render.
   * @param {DOMElement} container DOM element to render into.
   * @param {?function} callback function triggered on completion
   * @return {ReactComponent} Component instance rendered in `container`.
   */
  renderSubtreeIntoContainer: function(parentComponent, nextElement, container, callback) {
    invariant(
      parentComponent != null && parentComponent._reactInternalInstance != null,
      'parentComponent must be a valid React Component'
    );
    return ReactMount._renderSubtreeIntoContainer(
      parentComponent,
      nextElement,
      container,
      callback
    );
  },


  
  /**
   * 渲染子树容器，相当于渲染子组件
   * @param {*} parentComponent 父组件，如果是ReactDOM.render执行的则为null
   * @param {*} nextElement 要渲染的组件元素 （bebal转义后的组件）
   * @param {*} container   容器，装要渲染的组件元素
   * @param {*} callback    渲染完毕时触发
   * @returns 
   */
  _renderSubtreeIntoContainer: function(parentComponent, nextElement, container, callback) {

    /* 
        验证回调，是否是函数等等

        参数为 回调  字符串
    
    */
    ReactUpdateQueue.validateCallback(callback, 'ReactDOM.render');




    /* 
          会将根组件进一步封装，封装多一层，得到一个新react元素，此时该新的react元素的props就是根组件
          相当于将根组件作为新react元素的子组件存在
          nextWrappedElement对象为
          {

            // 此标记允许我们将其唯一标识为React元素，相当于将其标识为react元素
            $$typeof: REACT_ELEMENT_TYPE, 

            // 为组件的类型，引用类型则为函数或类
            type:TopLevelWrapper,

            key: null,

            ref: null,
    
            props: nextElement,

            // 记录负责创建此元素的组件。
            _owner: null,

          };

          这个结构也是bebal转义后的结构

    
    */
    var nextWrappedElement = ReactElement(
      TopLevelWrapper,
      null,
      null,
      null,
      null,
      null,
      nextElement
    );


    /* 
       获取旧组件
          如果渲染过，则返回_nativeContainerInfo._topLevelWrapper
          如果没渲染过，则返回null
    */
    var prevComponent = getTopLevelWrapperInContainer(container);  


    // 判断是否有该组件，如果有则做出相应的处理
    if (prevComponent) {
      var prevWrappedElement = prevComponent._currentElement; // 因为根组件该参数是nextWrappedElement

      var prevElement = prevWrappedElement.props;  // 获取nextWrappedElement对象的props,为旧组件babel转义


      // 判断新旧元素是否一致
      if (shouldUpdateReactComponent(prevElement, nextElement)) {
        var publicInst = prevComponent._renderedComponent.getPublicInstance(); // 获取new 函数 的实例
        var updatedCallback = callback && function() {
          callback.call(publicInst);
        };

        // 更新组件
        ReactMount._updateRootComponent(
          prevComponent,
          nextWrappedElement,
          container,
          updatedCallback
        );
        return publicInst;
      } else {
        ReactMount.unmountComponentAtNode(container);  // 卸载组件
      };
    };


    /* 
        如果参数是document文档节点，则返回html节点，否则返回参数的第一个子节点
    */
    var reactRootElement = getReactRootElementInContainer(container);  


    /* 
        如果reactRootElement没值，则containerHasReactMarkup为null
        如果reactRootElement有值，则看reactRootElement节点有没有data-reactid属性 如果有则返回该属性，如果没有则返回null
    */
    var containerHasReactMarkup = reactRootElement && !!internalGetID(reactRootElement);


    /* 
        如果参数有子节点，则获取该参数组件初始化实例，并返回false 
        否则返回 unedfined
    */
    var containerHasNonRootReactChild = hasNonRootReactChild(container); 




    /* 
         containerHasReactMarkup为根react节点的data-reactid属性，没有则为null
         prevComponent为旧组件初始化实例，没有则为null
         containerHasNonRootReactChild为false
    
    */
    var shouldReuseMarkup = containerHasReactMarkup && !prevComponent && !containerHasNonRootReactChild;
      

    // 将要渲染的组件渲染到容器中
    var component = ReactMount._renderNewRootComponent(
      nextWrappedElement, // 对根组件进行包装后的新的react元素

      container, // 容器

      shouldReuseMarkup, // 如果containerHasReactMarkup没值，则该属性为undefined

      parentComponent != null ? parentComponent._reactInternalInstance._processChildContext(
          parentComponent._reactInternalInstance._context
        ) : emptyObject // 如果_renderSubtreeIntoContainer函数由ReactDOM.render执行的，则为emptyObject

    )._renderedComponent.getPublicInstance();
    
    // 判断是否有该回调函数
    if (callback) {
      callback.call(component); //执行回调函数
    }


    return component;
  },





  /**
   * 入口函数
   * 将React组件呈现到提供的“容器”中的DOM中。
   *
   * 如果之前有将React组件呈现到“容器”中，则将对其执行更新，并仅更改必要的DOM以反映最新的React组件。
   *
   * @param {ReactElement} nextElement 要渲染的组件元素
   * @param {DOMElement} container 容器，将要渲染的组件插到该容器中
   * @param {?function} callback 渲染完成时触发的功能函数
   * @return {ReactComponent} 在“容器”中呈现的组件实例。
   */
  render: function(nextElement, container, callback) {

    // 渲染子树容器，也就是渲染子组件
    // 参数为 null  要渲染的组件元素  容器  回调
    return ReactMount._renderSubtreeIntoContainer(null, nextElement, container, callback);
  },







  /**
   * Unmounts and destroys the React component rendered in the `container`.
   *
   * @param {DOMElement} container DOM element containing a React component.
   * @return {boolean} True if a component was found in and unmounted from
   *                   `container`
   */
  unmountComponentAtNode: function(container) {
    // Various parts of our code (such as ReactCompositeComponent's
    // _renderValidatedComponent) assume that calls to render aren't nested;
    // verify that that's the case. (Strictly speaking, unmounting won't cause a
    // render but we still don't expect to be in a render call here.)
    warning(
      ReactCurrentOwner.current == null,
      'unmountComponentAtNode(): Render methods should be a pure function ' +
      'of props and state; triggering nested component updates from render ' +
      'is not allowed. If necessary, trigger nested updates in ' +
      'componentDidUpdate. Check the render method of %s.',
      ReactCurrentOwner.current && ReactCurrentOwner.current.getName() ||
        'ReactCompositeComponent'
    );

    invariant(
      container && (
        container.nodeType === ELEMENT_NODE_TYPE ||
        container.nodeType === DOC_NODE_TYPE ||
        container.nodeType === DOCUMENT_FRAGMENT_NODE_TYPE
      ),
      'unmountComponentAtNode(...): Target container is not a DOM element.'
    );

    var prevComponent = getTopLevelWrapperInContainer(container);
    if (!prevComponent) {
      // Check if the node being unmounted was rendered by React, but isn't a
      // root node.
      var containerHasNonRootReactChild = hasNonRootReactChild(container);

      // Check if the container itself is a React root node.
      var isContainerReactRoot =
        container.nodeType === 1 && container.hasAttribute(ROOT_ATTR_NAME);

      if (__DEV__) {
        warning(
          !containerHasNonRootReactChild,
          'unmountComponentAtNode(): The node you\'re attempting to unmount ' +
          'was rendered by React and is not a top-level container. %s',
          (
            isContainerReactRoot ?
              'You may have accidentally passed in a React root node instead ' +
              'of its container.' :
              'Instead, have the parent component update its state and ' +
              'rerender in order to remove this component.'
          )
        );
      }

      return false;
    }
    delete instancesByReactRootID[prevComponent._instance.rootID];
    ReactUpdates.batchedUpdates(
      unmountComponentFromNode,
      prevComponent,
      container,
      false
    );
    return true;
  },



  /**
   * 
   * @param {*} markup               // 一整科节点树渲染后的对象  lazyTree对象
   * @param {*} container            // 容器
   * @param {*} instance             // 组件初始化实例
   * @param {*} shouldReuseMarkup    // 首次为false
   * @param {*} transaction          // 事务
   * @returns 
   */
  _mountImageIntoNode: function(
    markup,
    container,
    instance,
    shouldReuseMarkup,
    transaction
  ) {
    

    if (shouldReuseMarkup) {
      var rootElement = getReactRootElementInContainer(container);
      if (ReactMarkupChecksum.canReuseMarkup(markup, rootElement)) {
        ReactDOMComponentTree.precacheNode(instance, rootElement);
        return;
      } else {
        var checksum = rootElement.getAttribute(
          ReactMarkupChecksum.CHECKSUM_ATTR_NAME
        );
        rootElement.removeAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);

        var rootMarkup = rootElement.outerHTML;
        rootElement.setAttribute(
          ReactMarkupChecksum.CHECKSUM_ATTR_NAME,
          checksum
        );

        var normalizedMarkup = markup;
        

        var diffIndex = firstDifferenceIndex(normalizedMarkup, rootMarkup);
        var difference = ' (client) ' +
          normalizedMarkup.substring(diffIndex - 20, diffIndex + 20) +
          '\n (server) ' + rootMarkup.substring(diffIndex - 20, diffIndex + 20);

        
      }
    }

   
    
    // 首次时为true
    if (transaction.useCreateElement) {
      // 判断有没有最后一个子节点
      while (container.lastChild) { // 循环删除节点
        container.removeChild(container.lastChild); // 删除最后一个子节点
      }
      DOMLazyTree.insertTreeBefore(container, markup, null);
    } else {
      setInnerHTML(container, markup);
      ReactDOMComponentTree.precacheNode(instance, container.firstChild);
    }
  },
};

ReactPerf.measureMethods(ReactMount, 'ReactMount', {
  _renderNewRootComponent: '_renderNewRootComponent',
  _mountImageIntoNode: '_mountImageIntoNode',
});

module.exports = ReactMount;
