/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMComponent
 */

/* global hasOwnProperty:true */

'use strict';

var AutoFocusUtils = require('AutoFocusUtils');
var CSSPropertyOperations = require('CSSPropertyOperations');
var DOMLazyTree = require('DOMLazyTree');
var DOMNamespaces = require('DOMNamespaces');
var DOMProperty = require('DOMProperty');
var DOMPropertyOperations = require('DOMPropertyOperations');
var EventConstants = require('EventConstants');
var EventPluginHub = require('EventPluginHub');
var EventPluginRegistry = require('EventPluginRegistry');
var ReactBrowserEventEmitter = require('ReactBrowserEventEmitter');
var ReactComponentBrowserEnvironment = require('ReactComponentBrowserEnvironment');
var ReactDOMButton = require('ReactDOMButton');
var ReactDOMComponentFlags = require('ReactDOMComponentFlags');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var ReactDOMInput = require('ReactDOMInput');
var ReactDOMOption = require('ReactDOMOption');
var ReactDOMSelect = require('ReactDOMSelect');
var ReactDOMTextarea = require('ReactDOMTextarea');
var ReactMultiChild = require('ReactMultiChild');
var ReactPerf = require('ReactPerf');

var escapeTextContentForBrowser = require('escapeTextContentForBrowser');
var invariant = require('invariant');
var isEventSupported = require('isEventSupported');
var keyOf = require('keyOf');
var shallowEqual = require('shallowEqual');
var validateDOMNesting = require('validateDOMNesting');
var warning = require('warning');

var Flags = ReactDOMComponentFlags;
var deleteListener = EventPluginHub.deleteListener;
var getNode = ReactDOMComponentTree.getNodeFromInstance;
var listenTo = ReactBrowserEventEmitter.listenTo;
var registrationNameModules = EventPluginRegistry.registrationNameModules;

// 为了快速匹配子类型，测试是否可以作为内容处理。
var CONTENT_TYPES = {'string': true, 'number': true};

var STYLE = keyOf({style: null});
var HTML = keyOf({__html: null});
var RESERVED_PROPS = {
  children: null,
  dangerouslySetInnerHTML: null,
  suppressContentEditableWarning: null,
};

// Node type for document fragments (Node.DOCUMENT_FRAGMENT_NODE).
var DOC_FRAGMENT_TYPE = 11;


function getDeclarationErrorAddendum(internalInstance) {
  if (internalInstance) {
    var owner = internalInstance._currentElement._owner || null;
    if (owner) {
      var name = owner.getName();
      if (name) {
        return ' This DOM node was rendered by `' + name + '`.';
      }
    }
  }
  return '';
}

function friendlyStringify(obj) {
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return '[' + obj.map(friendlyStringify).join(', ') + ']';
    } else {
      var pairs = [];
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          var keyEscaped = /^[a-z$_][\w$_]*$/i.test(key) ?
            key :
            JSON.stringify(key);
          pairs.push(keyEscaped + ': ' + friendlyStringify(obj[key]));
        }
      }
      return '{' + pairs.join(', ') + '}';
    }
  } else if (typeof obj === 'string') {
    return JSON.stringify(obj);
  } else if (typeof obj === 'function') {
    return '[function object]';
  }
  // Differs from JSON.stringify in that undefined because undefined and that
  // inf and nan don't become null
  return String(obj);
}

var styleMutationWarning = {};

function checkAndWarnForMutatedStyle(style1, style2, component) {
  if (style1 == null || style2 == null) {
    return;
  }
  if (shallowEqual(style1, style2)) {
    return;
  }

  var componentName = component._tag;
  var owner = component._currentElement._owner;
  var ownerName;
  if (owner) {
    ownerName = owner.getName();
  }

  var hash = ownerName + '|' + componentName;

  if (styleMutationWarning.hasOwnProperty(hash)) {
    return;
  }

  styleMutationWarning[hash] = true;

  warning(
    false,
    '`%s` was passed a style object that has previously been mutated. ' +
    'Mutating `style` is deprecated. Consider cloning it beforehand. Check ' +
    'the `render` %s. Previous style: %s. Mutated style: %s.',
    componentName,
    owner ? 'of `' + ownerName + '`' : 'using <' + componentName + '>',
    friendlyStringify(style1),
    friendlyStringify(style2)
  );
}

/**
 * 判断指定的属性是否有效
 * @param {object} component  组件初始化的实例
 * @param {?object} props   属性
 */
function assertValidProps(component, props) {
  if (!props) {
    return;  // 没有属性则直接结束
  }
  // Note the use of `==` which checks for null or undefined. 注意`=`的使用，它检查是否为空或未定义
  // 判断是否是voidElementTags对象里的其中一个标签类型
  if (voidElementTags[component._tag]) {
    invariant(
      props.children == null && props.dangerouslySetInnerHTML == null,
      '%s is a void element tag and must not have `children` or ' +
      'use `props.dangerouslySetInnerHTML`.%s',
      component._tag,
      component._currentElement._owner ?
        ' Check the render method of ' +
        component._currentElement._owner.getName() + '.' :
        ''
    );
  }

  // 判断是否有插入标签的html的属性
  if (props.dangerouslySetInnerHTML != null) {
    invariant(
      props.children == null,
      'Can only set one of `children` or `props.dangerouslySetInnerHTML`.'
    );
    invariant(
      typeof props.dangerouslySetInnerHTML === 'object' &&
      HTML in props.dangerouslySetInnerHTML,
      '`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. ' +
      'Please visit https://fb.me/react-invariant-dangerously-set-inner-html ' +
      'for more information.'
    );
  }

  if (__DEV__) {
    warning(
      props.innerHTML == null,
      'Directly setting property `innerHTML` is not permitted. ' +
      'For more information, lookup documentation on `dangerouslySetInnerHTML`.'
    );
    warning(
      props.suppressContentEditableWarning ||
      !props.contentEditable ||
      props.children == null,
      'A component is `contentEditable` and contains `children` managed by ' +
      'React. It is now your responsibility to guarantee that none of ' +
      'those nodes are unexpectedly modified or duplicated. This is ' +
      'probably not intentional.'
    );
    warning(
      props.onFocusIn == null &&
      props.onFocusOut == null,
      'React uses onFocus and onBlur instead of onFocusIn and onFocusOut. ' +
      'All React events are normalized to bubble, so onFocusIn and onFocusOut ' +
      'are not needed/supported by React.'
    );
  }

  invariant(
    props.style == null || typeof props.style === 'object',
    'The `style` prop expects a mapping from style properties to values, ' +
    'not a string. For example, style={{marginRight: spacing + \'em\'}} when ' +
    'using JSX.%s',
     getDeclarationErrorAddendum(component)
  );
}


/**
 *  负责事件注册。
 * 
 * @param {*} inst                 组件初始化实例
 * @param {*} registrationName     React 事件，如：onClick、onChange
 * @param {*} listener             事件处理函数
 * @param {*} transaction          事务
 * @returns 
 */
function enqueuePutListener(inst, registrationName, listener, transaction) {

  if (__DEV__) {
    // IE8 has no API for event capturing and the `onScroll` event doesn't
    // bubble.
    warning(
      registrationName !== 'onScroll' || isEventSupported('scroll', true),
      'This browser doesn\'t support the `onScroll` event'
    );
  }

  var containerInfo = inst._nativeContainerInfo;   // 集装信息，主要存储容器和包装后的根组件的一些信息

  // 判断有没有容器节点，并且该容器节点的类型为 11(文档片段节点) 
  var isDocumentFragment = containerInfo._node && containerInfo._node.nodeType === DOC_FRAGMENT_TYPE;

  // 判断该容器类型是否是文档片段节点 如果是 则为该文档片段节点 如果不是则获取该文档节点  // doc 为找到的 document 节点
  var doc = isDocumentFragment ? containerInfo._node : containerInfo._ownerDocument;

  // 判断是否没有文档节点
  if (!doc) {
    // Server rendering.
    return; // 直接结束
  }

  // 参数为 事件名、文档节点, 进行事件注册
  listenTo(registrationName, doc);

  // 向CallbackQueue模块中存储回调和信息对象
  transaction.getReactMountReady().enqueue(putListener, {
    inst: inst,
    registrationName: registrationName,
    listener: listener,
  });
}

function putListener() {
  var listenerToPut = this;
  EventPluginHub.putListener(
    listenerToPut.inst,
    listenerToPut.registrationName,
    listenerToPut.listener
  );
}

function optionPostMount() {
  var inst = this;
  ReactDOMOption.postMountWrapper(inst);
}

// There are so many media events, it makes sense to just
// maintain a list rather than create a `trapBubbledEvent` for each
var mediaEvents = {
  topAbort: 'abort',
  topCanPlay: 'canplay',
  topCanPlayThrough: 'canplaythrough',
  topDurationChange: 'durationchange',
  topEmptied: 'emptied',
  topEncrypted: 'encrypted',
  topEnded: 'ended',
  topError: 'error',
  topLoadedData: 'loadeddata',
  topLoadedMetadata: 'loadedmetadata',
  topLoadStart: 'loadstart',
  topPause: 'pause',
  topPlay: 'play',
  topPlaying: 'playing',
  topProgress: 'progress',
  topRateChange: 'ratechange',
  topSeeked: 'seeked',
  topSeeking: 'seeking',
  topStalled: 'stalled',
  topSuspend: 'suspend',
  topTimeUpdate: 'timeupdate',
  topVolumeChange: 'volumechange',
  topWaiting: 'waiting',
};

function trapBubbledEventsLocal() {
  var inst = this;
  // If a component renders to null or if another component fatals and causes
  // the state of the tree to be corrupted, `node` here can be null.
  invariant(inst._rootNodeID, 'Must be mounted to trap events');
  var node = getNode(inst);
  invariant(
    node,
    'trapBubbledEvent(...): Requires node to be rendered.'
  );

  switch (inst._tag) {
    case 'iframe':
    case 'object':
      inst._wrapperState.listeners = [
        ReactBrowserEventEmitter.trapBubbledEvent(
          EventConstants.topLevelTypes.topLoad,
          'load',
          node
        ),
      ];
      break;
    case 'video':
    case 'audio':

      inst._wrapperState.listeners = [];
      // Create listener for each media event
      for (var event in mediaEvents) {
        if (mediaEvents.hasOwnProperty(event)) {
          inst._wrapperState.listeners.push(
            ReactBrowserEventEmitter.trapBubbledEvent(
              EventConstants.topLevelTypes[event],
              mediaEvents[event],
              node
            )
          );
        }
      }

      break;
    case 'img':
      inst._wrapperState.listeners = [
        ReactBrowserEventEmitter.trapBubbledEvent(
          EventConstants.topLevelTypes.topError,
          'error',
          node
        ),
        ReactBrowserEventEmitter.trapBubbledEvent(
          EventConstants.topLevelTypes.topLoad,
          'load',
          node
        ),
      ];
      break;
    case 'form':
      inst._wrapperState.listeners = [
        ReactBrowserEventEmitter.trapBubbledEvent(
          EventConstants.topLevelTypes.topReset,
          'reset',
          node
        ),
        ReactBrowserEventEmitter.trapBubbledEvent(
          EventConstants.topLevelTypes.topSubmit,
          'submit',
          node
        ),
      ];
      break;
    case 'input':
    case 'select':
    case 'textarea':
      inst._wrapperState.listeners = [
        ReactBrowserEventEmitter.trapBubbledEvent(
          EventConstants.topLevelTypes.topInvalid,
          'invalid',
          node
        ),
      ];
      break;
  }
}

function postUpdateSelectWrapper() {
  ReactDOMSelect.postUpdateWrapper(this);
}

// For HTML, certain tags should omit their close tag. We keep a whitelist for
// those special-case tags.

var omittedCloseTags = {
  'area': true,
  'base': true,
  'br': true,
  'col': true,
  'embed': true,
  'hr': true,
  'img': true,
  'input': true,
  'keygen': true,
  'link': true,
  'meta': true,
  'param': true,
  'source': true,
  'track': true,
  'wbr': true,
  // NOTE: menuitem's close tag should be omitted, but that causes problems.
};

var newlineEatingTags = {
  'listing': true,
  'pre': true,
  'textarea': true,
};

// For HTML, certain tags cannot have children. This has the same purpose as
// `omittedCloseTags` except that `menuitem` should still have its closing tag.

var voidElementTags = Object.assign({
  'menuitem': true,
}, omittedCloseTags);

// We accept any tag to be rendered but since this gets injected into arbitrary
// HTML, we want to make sure that it's a safe tag.
// http://www.w3.org/TR/REC-xml/#NT-Name

var VALID_TAG_REGEX = /^[a-zA-Z][a-zA-Z:_\.\-\d]*$/; // Simplified subset
var validatedTagCache = {};
var hasOwnProperty = {}.hasOwnProperty;

function validateDangerousTag(tag) {
  if (!hasOwnProperty.call(validatedTagCache, tag)) {
    invariant(VALID_TAG_REGEX.test(tag), 'Invalid tag: %s', tag);
    validatedTagCache[tag] = true;
  }
}

/**
 * 
 * @param {*} tagName  标签名
 * @param {*} props    属性
 * @returns 
 */
function isCustomComponent(tagName, props) {
  return tagName.indexOf('-') >= 0 || props.is != null; 
}

var globalIdCounter = 1;

/**
 * Creates a new React class that is idempotent and capable of containing other
 * React components. It accepts event listeners and DOM properties that are
 * valid according to `DOMProperty`.
 *
 *  - Event listeners: `onClick`, `onMouseDown`, etc.
 *  - DOM properties: `className`, `name`, `title`, etc.
 *
 * The `style` property functions differently from the DOM API. It accepts an
 * object mapping of style properties to values.
 *
 * @constructor ReactDOMComponent
 * @extends ReactMultiChild
 */
function ReactDOMComponent(element) {
  var tag = element.type; // 标签名字
  validateDangerousTag(tag); // 验证标签是否正确
  this._currentElement = element; // babel转义后的标签
  this._tag = tag.toLowerCase(); // 将标签名字转为小写

  // 下面进行属性的初始默认值
  this._namespaceURI = null;
  this._renderedChildren = null;
  this._previousStyle = null;
  this._previousStyleCopy = null;
  this._nativeNode = null;
  this._nativeParent = null;
  this._rootNodeID = null;
  this._domID = null;
  this._nativeContainerInfo = null;
  this._wrapperState = null;
  this._topLevelWrapper = null;
  this._flags = 0;
  if (__DEV__) {
    this._ancestorInfo = null;
  }
}

ReactDOMComponent.displayName = 'ReactDOMComponent';  // 设置dom类型组件的名字

ReactDOMComponent.Mixin = {

  /**
   * Generates root tag markup then recurses. This method has side effects and
   * is not idempotent.
   *
   * @internal
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction 事务
   * @param {?ReactDOMComponent} the containing DOM component instance  如果是则根组件为null
   * @param {?object} info about the native container
   * @param {object} context
   * @return {string} The computed markup.
   */ 
  mountComponent: function(
    transaction,
    nativeParent,
    nativeContainerInfo,
    context
  ) {
    // this为组件初始化实例

    this._rootNodeID = globalIdCounter++;
    this._domID = nativeContainerInfo._idCounter++;
    this._nativeParent = nativeParent;
    this._nativeContainerInfo = nativeContainerInfo; // 集装信息，为一个对象，存储一些基础信息

    var props = this._currentElement.props;  // props属性

    // 根据标签进行对应处理
    switch (this._tag) {
      case 'iframe':
      case 'object':
      case 'img':
      case 'form':
      case 'video':
      case 'audio':
        this._wrapperState = {
          listeners: null,
        };
        transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
        break;
      case 'button':
        //getNativeProps为DisabledInputUtils模块的的getNativeProps函数，判断处理后返回props属性
        /* 
              如果是禁用的属性disabled，则返回原来的props
              否则返回除鼠标事件以外的属性对象
        */
        props = ReactDOMButton.getNativeProps(this, props, nativeParent); // 对props变量进行重新赋值
        break;
      case 'input':
        ReactDOMInput.mountWrapper(this, props, nativeParent);
        props = ReactDOMInput.getNativeProps(this, props);
        transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
        break;
      case 'option':
        ReactDOMOption.mountWrapper(this, props, nativeParent);
        props = ReactDOMOption.getNativeProps(this, props);
        break;
      case 'select':
        ReactDOMSelect.mountWrapper(this, props, nativeParent);
        props = ReactDOMSelect.getNativeProps(this, props);
        transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
        break;
      case 'textarea':
        ReactDOMTextarea.mountWrapper(this, props, nativeParent);
        props = ReactDOMTextarea.getNativeProps(this, props);
        transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
        break;
    }

    assertValidProps(this, props); // 判断指定的属性是否有效

    // 我们在其父容器的命名空间中创建标记，HTML除外
    // 标签没有名称空间
    var namespaceURI;
    var parentTag;

    // 判断nativeParent是否有值
    if (nativeParent != null) {
      namespaceURI = nativeParent._namespaceURI;
      parentTag = nativeParent._tag;
    } else if (nativeContainerInfo._tag) { // 是否有标签
      namespaceURI = nativeContainerInfo._namespaceURI;  // 装载渲染组件的dom容器的文档url
      parentTag = nativeContainerInfo._tag;              // 装载渲染组件的dom容器的标签名称
    }

    /* 
        判断是否需要修正w3c文档地址
        判断dom容器w3c的url是否为null 或者 w3c是svg类型的 
        并且 容器为foreignobject标签
    */
    if (namespaceURI == null || namespaceURI === DOMNamespaces.svg && parentTag === 'foreignobject') {
      namespaceURI = DOMNamespaces.html;  // 修正w3c文档地址
    }
    
    // 判断是否是xhtml地址
    if (namespaceURI === DOMNamespaces.html) {
      // 判断容器类型，进行修正文档地址
      if (this._tag === 'svg') {
        namespaceURI = DOMNamespaces.svg;
      } else if (this._tag === 'math') {
        namespaceURI = DOMNamespaces.mathml;
      }
    }
    this._namespaceURI = namespaceURI;  // 存储容器的3wc地址到初始化实例中

    if (__DEV__) {
      var parentInfo;
      if (nativeParent != null) {
        parentInfo = nativeParent._ancestorInfo;
      } else if (nativeContainerInfo._tag) {
        parentInfo = nativeContainerInfo._ancestorInfo;
      }
      if (parentInfo) {
        // parentInfo should always be present except for the top-level
        // component when server rendering
        validateDOMNesting(this._tag, this, parentInfo);
      }
      this._ancestorInfo =
        validateDOMNesting.updatedAncestorInfo(parentInfo, this._tag, this);
    }

    var mountImage;  

    /* 
        该useCreateElement属性为开始 ReactDOM.render时里面处理的shouldReuseMarkup参数
    */
    if (transaction.useCreateElement) {
      var ownerDocument = nativeContainerInfo._ownerDocument; // 获取文档节点
      var el;
      if (namespaceURI === DOMNamespaces.html) {

        // 判断标签是否是script标签
        if (this._tag === 'script') {
         // 通过.innerHTML创建脚本，使其“parser-inserted”标志为设置为true，则不执行

          var div = ownerDocument.createElement('div'); // 创建div标签
          var type = this._currentElement.type;  // 为标签名称 如 div、span
          div.innerHTML = `<${type}></${type}>`; // 将div的子节点设为script标签
          el = div.removeChild(div.firstChild);  // 删除后返回子节点
        } else {
          el = ownerDocument.createElement(this._currentElement.type); // 创建其他标签
        }
      } else {
        el = ownerDocument.createElementNS(
          namespaceURI,
          this._currentElement.type
        );  // 创建标签
      }

      // 第一个参数为组件初始化实例，第二个为标签
      ReactDOMComponentTree.precacheNode(this, el); // 处理组件初始化实例和标签，将标签存到组件初始化实例中，并将组件初始化实例存到标签的随机属性中

      this._flags |= Flags.hasCachedChildNodes;  // 相加后的结果赋值给this._flags

      // 判断是否没有值，没有值表示为根节点
      if (!this._nativeParent) {
        DOMPropertyOperations.setAttributeForRoot(el);  // 给该节点添加一个属性，为data-reactroot，表示根标签
      }



      // 参数为 null  属性  事务
      this._updateDOMProperties(null, props, transaction);  
      // 对属性进行处理，其中对包含在节点上设置属性、样式、以及向文档节点注册事件



      // 参数为创建好的节点
      var lazyTree = DOMLazyTree(el); // 会返回一个对象，对象中有node、children、html、text这些属性
      /* 
             该函数得到一个对象
             {
                node: node, 
                children: [],
                html: null,
                text: null,
             };
      
      */




      // 参数为 事务、属性、上下文、lazyTree对象
      this._createInitialChildren(transaction, props, context, lazyTree); // 会递归渲染子节点

      mountImage = lazyTree;  // 这个时候lazyTree对象已经被填充好了
    } else {
      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);
      var tagContent = this._createContentMarkup(transaction, props, context);
      if (!tagContent && omittedCloseTags[this._tag]) {
        mountImage = tagOpen + '/>';
      } else {
        mountImage =
          tagOpen + '>' + tagContent + '</' + this._currentElement.type + '>';
      }
    }

    
    switch (this._tag) {
      case 'button':
      case 'input':
      case 'select':
      case 'textarea':
        if (props.autoFocus) {
          transaction.getReactMountReady().enqueue(
            AutoFocusUtils.focusDOMComponent,
            this
          );
        }
        break;
      case 'option':
        transaction.getReactMountReady().enqueue(
          optionPostMount,
          this
        );
    }

    return mountImage;
  },

  /**
   * Creates markup for the open tag and all attributes.
   *
   * This method has side effects because events get registered.
   *
   * Iterating over object properties is faster than iterating over arrays.
   * @see http://jsperf.com/obj-vs-arr-iteration
   *
   * @private
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {object} props
   * @return {string} Markup of opening tag.
   */
  _createOpenTagMarkupAndPutListeners: function(transaction, props) {
    var ret = '<' + this._currentElement.type;

    for (var propKey in props) {
      if (!props.hasOwnProperty(propKey)) {
        continue;
      }
      var propValue = props[propKey];
      if (propValue == null) {
        continue;
      }
      if (registrationNameModules.hasOwnProperty(propKey)) { 
        if (propValue) {
          enqueuePutListener(this, propKey, propValue, transaction);
        }
      } else {
        if (propKey === STYLE) {
          if (propValue) {
            if (__DEV__) {
              // See `_updateDOMProperties`. style block
              this._previousStyle = propValue;
            }
            propValue = this._previousStyleCopy = Object.assign({}, props.style);
          }
          propValue = CSSPropertyOperations.createMarkupForStyles(propValue, this);
        }
        var markup = null;
        if (this._tag != null && isCustomComponent(this._tag, props)) {
          if (!RESERVED_PROPS.hasOwnProperty(propKey)) {
            markup = DOMPropertyOperations.createMarkupForCustomAttribute(propKey, propValue);
          }
        } else {
          markup = DOMPropertyOperations.createMarkupForProperty(propKey, propValue);
        }
        if (markup) {
          ret += ' ' + markup;
        }
      }
    }

    // For static pages, no need to put React ID and checksum. Saves lots of
    // bytes.
    if (transaction.renderToStaticMarkup) {
      return ret;
    }

    if (!this._nativeParent) {
      ret += ' ' + DOMPropertyOperations.createMarkupForRoot();
    }
    ret += ' ' + DOMPropertyOperations.createMarkupForID(this._domID);
    return ret;
  },

  /**
   * Creates markup for the content between the tags.
   *
   * @private
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {object} props
   * @param {object} context
   * @return {string} Content markup.
   */
  _createContentMarkup: function(transaction, props, context) {
    var ret = '';

    // Intentional use of != to avoid catching zero/false.
    var innerHTML = props.dangerouslySetInnerHTML;
    if (innerHTML != null) {
      if (innerHTML.__html != null) {
        ret = innerHTML.__html;
      }
    } else {
      var contentToUse =
        CONTENT_TYPES[typeof props.children] ? props.children : null;  // 判断子节点是否是数字类型或字符串类型

      var childrenToUse = contentToUse != null ? null : props.children; // 判断子节点是否是数组类型

      if (contentToUse != null) {
        // 验证文本是否允许作为此节点的子节点
        ret = escapeTextContentForBrowser(contentToUse);
      } else if (childrenToUse != null) {  // 处理数组类型的子节点
        var mountImages = this.mountChildren(
          childrenToUse,
          transaction,
          context
        );
        ret = mountImages.join('');
      }
    }
    if (newlineEatingTags[this._tag] && ret.charAt(0) === '\n') {
      // text/html ignores the first character in these tags if it's a newline
      // Prefer to break application/xml over text/html (for now) by adding
      // a newline specifically to get eaten by the parser. (Alternately for
      // textareas, replacing "^\n" with "\r\n" doesn't get eaten, and the first
      // \r is normalized out by HTMLTextAreaElement#value.)
      // See: <http://www.w3.org/TR/html-polyglot/#newlines-in-textarea-and-pre>
      // See: <http://www.w3.org/TR/html5/syntax.html#element-restrictions>
      // See: <http://www.w3.org/TR/html5/syntax.html#newlines>
      // See: Parsing of "textarea" "listing" and "pre" elements
      //  from <http://www.w3.org/TR/html5/syntax.html#parsing-main-inbody>
      return '\n' + ret;
    } else {
      return ret;
    }
  },

  // 参数为 事务、属性、上下文、lazyTree对象
  _createInitialChildren: function(transaction, props, context, lazyTree) {
 
    var innerHTML = props.dangerouslySetInnerHTML; // 属性中是否拥有dangerouslySetInnerHTML属性

    if (innerHTML != null) {
      // 判断dangerouslySetInnerHTML对象中__html属性是否有值
      if (innerHTML.__html != null) {
        // 参数为 lazyTree对象、__html内容
        DOMLazyTree.queueHTML(lazyTree, innerHTML.__html); // 为lazyTree对象中标签的innHTML注入内容
      }

    } else {

      // 判断子节点是否是字符串或数字
      var contentToUse = CONTENT_TYPES[typeof props.children] ? props.children : null; 

      // 判断子节点是否是字符串或数字，如果不是则为dom组件、自定义组件、数组等
      var childrenToUse = contentToUse != null ? null : props.children; 


      if (contentToUse != null) {
        // 进来这里，那么子节点就是字符串或数字

        // 验证文本是否符合作为该标签的子节点。参数为 lazyTree对象、文本
        DOMLazyTree.queueText(lazyTree, contentToUse); 

      } else if (childrenToUse != null) {  // 判断子节点是否有值
        // 子节点不是文本的情况下
        
        var mountImages = this.mountChildren(
          childrenToUse, // 子节点
          transaction,   // 事务
          context        // 上下文
        );
        for (var i = 0; i < mountImages.length; i++) {
          DOMLazyTree.queueChild(lazyTree, mountImages[i]);
        }
      }

    }
  },

  /**
   * Receives a next element and updates the component.
   *
   * @internal
   * @param {ReactElement} nextElement
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {object} context
   */
  receiveComponent: function(nextElement, transaction, context) {
    var prevElement = this._currentElement;
    this._currentElement = nextElement;
    this.updateComponent(transaction, prevElement, nextElement, context);
  },

  /**
   * Updates a native DOM component after it has already been allocated and
   * attached to the DOM. Reconciles the root DOM node, then recurses.
   *
   * @param {ReactReconcileTransaction} transaction
   * @param {ReactElement} prevElement
   * @param {ReactElement} nextElement
   * @internal
   * @overridable
   */
  updateComponent: function(transaction, prevElement, nextElement, context) {
    var lastProps = prevElement.props;
    var nextProps = this._currentElement.props;

    switch (this._tag) {
      case 'button':
        lastProps = ReactDOMButton.getNativeProps(this, lastProps);
        nextProps = ReactDOMButton.getNativeProps(this, nextProps);
        break;
      case 'input':
        ReactDOMInput.updateWrapper(this);
        lastProps = ReactDOMInput.getNativeProps(this, lastProps);
        nextProps = ReactDOMInput.getNativeProps(this, nextProps);
        break;
      case 'option':
        lastProps = ReactDOMOption.getNativeProps(this, lastProps);
        nextProps = ReactDOMOption.getNativeProps(this, nextProps);
        break;
      case 'select':
        lastProps = ReactDOMSelect.getNativeProps(this, lastProps);
        nextProps = ReactDOMSelect.getNativeProps(this, nextProps);
        break;
      case 'textarea':
        ReactDOMTextarea.updateWrapper(this);
        lastProps = ReactDOMTextarea.getNativeProps(this, lastProps);
        nextProps = ReactDOMTextarea.getNativeProps(this, nextProps);
        break;
    }

    assertValidProps(this, nextProps);
    this._updateDOMProperties(lastProps, nextProps, transaction);
    this._updateDOMChildren(
      lastProps,
      nextProps,
      transaction,
      context
    );

    if (this._tag === 'select') {
      // <select> value update needs to occur after <option> children
      // reconciliation
      transaction.getReactMountReady().enqueue(postUpdateSelectWrapper, this);
    }
  },

  /**
   * 通过检测特性值的差异来协调特性，以及根据需要更新DOM。这个函数可能是最简单的性能优化的关键路径。
   *
   * @private
   * @param {object} lastProps   上一次属性
   * @param {object} nextProps   下一次属性
   * @param {?DOMElement} node   事务
   */
  _updateDOMProperties: function(lastProps, nextProps, transaction) {
    var propKey;  // 遍历时，属性当前项的名字
    var styleName;  // style遍历时, 属性的当前项的名字
    var styleUpdates; // 存储style属性对象中的属性，并且属性赋值为空字符串

    // 遍历旧属性
    for (propKey in lastProps) {

      // 新props中是否拥有该旧props的属性 或者 该属性是在旧props的原型上 或者 该属性为null
      if (nextProps.hasOwnProperty(propKey) || !lastProps.hasOwnProperty(propKey) || lastProps[propKey] == null) {
        continue;  // 越过本次循环
      }

      // 判断该属性是否为 style
      if (propKey === STYLE) {
        // 旧样式style的副本
        var lastStyle = this._previousStyleCopy; // 初始化实例中的属性，最开始该属性为null

        // 遍历该 style属性
        for (styleName in lastStyle) { 

          // 判断该 style属性中是否拥有该属性
          if (lastStyle.hasOwnProperty(styleName)) {
            styleUpdates = styleUpdates || {}; // 如果该styleUpdates没有值，就赋值为空对象
            styleUpdates[styleName] = '';      // 将该styleUpdates属性中设置值，并且为空字符串
          }
        }

        // 再重新赋值为null
        this._previousStyleCopy = null;

      } else if (registrationNameModules.hasOwnProperty(propKey)) { // 判断是否是事件名
        if (lastProps[propKey]) { // 判断该事件中有没有值
        
          deleteListener(this, propKey);  // 从事件存储库中删除该事件
        }
        
      } else if (DOMProperty.properties[propKey] || DOMProperty.isCustomAttribute(propKey)) {  // 判断是否是特殊的属性 如 type color data-xxx 等等

          // 第一个参数为dom节点，第二个为属性名
          DOMPropertyOperations.deleteValueForProperty(getNode(this), propKey);  // 该函数中会从dom中删除该属性
      }
    };

    // 遍历新属性
    for (propKey in nextProps) {

      var nextProp = nextProps[propKey]; // 属性值

      /* 
         该属性名是否是 style
         如果是则 将lastProp设置为组件初始化实例中的_previousStyleCopy属性，也就是将旧样式的副本赋值给lastProp变量
         如果不是 则判断参数lastProps是不是不等于null，如果是，则lastProp属性为 lastProps中的值，否则为undefined，赋值给lastProp变量
         
         该判断的目的就是为了获取旧属性的style值
      */
      var lastProp = propKey === STYLE ? this._previousStyleCopy : lastProps != null ? lastProps[propKey] : undefined;

      /* 
         新属性中该属性是在原型上 或者 新的属性值等于旧的属性值 或者 新属性值为null 并且 旧属性值为null 则跳过本次循环
      */
      if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp || nextProp == null && lastProp == null) {
        continue;
      }

      // 判断该属性是否是 style
      if (propKey === STYLE) {

        // 判断是否有值
        if (nextProp) {
          if (__DEV__) {
            checkAndWarnForMutatedStyle(
              this._previousStyleCopy,
              this._previousStyle,
              this
            );
            this._previousStyle = nextProp;
          }

          // 将style的值混入到新对象中，并赋值给初始化实例的_previousStyleCopy属性，并重新赋值给当前的nextProp属性
          // 相当于克隆一份副本给_previousStyleCopy
          nextProp = this._previousStyleCopy = Object.assign({}, nextProp); 
        } else {
          this._previousStyleCopy = null;  // style没有值，就将初始化实例中的_previousStyleCopy设置null
        }

        // 判断有没有旧的style属性
        if (lastProp) {
          // 取消设置`lastProp`上的样式，但不取消设置`nextProp`的样式。
          // 遍历旧属性的style值
          for (styleName in lastProp) {
            
            // 判断旧style中有该属性 并且 没有新style或者新属性style中没有该旧属性style中的值
            if (lastProp.hasOwnProperty(styleName) && (!nextProp || !nextProp.hasOwnProperty(styleName))) {
              styleUpdates = styleUpdates || {}; // 该属性如果没有值就赋值为空对象
              styleUpdates[styleName] = '';  // 将旧的style属性设置到该属性中，并置为空
            }
          }

          // 更新自`lastProp`以来更改的样式。
          // 遍历新的style属性值
          for (styleName in nextProp) {
            // 判断新style属性中有该属性 并且 旧style属性中该值不等于新值
            if (nextProp.hasOwnProperty(styleName) && lastProp[styleName] !== nextProp[styleName]) {
              styleUpdates = styleUpdates || {};  // 该属性如果没有值就赋值为空对象
              styleUpdates[styleName] = nextProp[styleName];// 新属性赋值进去
            }
          }
        } else {
          // 直接将新的style值赋值上去
          styleUpdates = nextProp;
        }
      } else if (registrationNameModules.hasOwnProperty(propKey)) { // 判断该属性是否是事件

        // 判断该属性有没有值
        if (nextProp) {
          /* 
              参数为 组件初始化实例、事件名、属性值、事务
              注册事件
          */
          enqueuePutListener(this, propKey, nextProp, transaction); 

        } else if (lastProp) {  // 判断旧属性中有没有该属性值

          deleteListener(this, propKey);  // 删除注册的事件处理函数

        }

      } else if (isCustomComponent(this._tag, nextProps)) {  // 判断是否是自定义标签 即标签名有没有 - 符号，或者 有is属性不等于null undefined
        
        /* 
            判断是否不是这几个特殊属性之一
            children、dangerouslySetInnerHTML、suppressContentEditableWarning
        
        */
        if (!RESERVED_PROPS.hasOwnProperty(propKey)) {
          DOMPropertyOperations.setValueForAttribute(
            getNode(this),
            propKey,
            nextProp
          );
        }
      } else if (DOMProperty.properties[propKey] || DOMProperty.isCustomAttribute(propKey)) {// 判断是否是特殊的属性 如 type color data-xxx 等等

        var node = getNode(this); // 获取该dom节点

        // 判断该属性有没有值
        if (nextProp != null) {
          DOMPropertyOperations.setValueForProperty(node, propKey, nextProp);  // 更新属性
        } else { 
          DOMPropertyOperations.deleteValueForProperty(node, propKey);  // 删除属性
        }
      }
    };

    // 判断有没有值
    if (styleUpdates) {

      // 将属性设置到dom节点上
      CSSPropertyOperations.setValueForStyles(
        getNode(this), // 当前dom节点
        styleUpdates,  // 样式对象
        this           // 组件
      );
    }
  },

  /**
   * Reconciles the children with the various properties that affect the
   * children content.
   *
   * @param {object} lastProps
   * @param {object} nextProps
   * @param {ReactReconcileTransaction} transaction
   * @param {object} context
   */
  _updateDOMChildren: function(lastProps, nextProps, transaction, context) {
    var lastContent = CONTENT_TYPES[typeof lastProps.children] ? lastProps.children : null;
    var nextContent = CONTENT_TYPES[typeof nextProps.children] ? nextProps.children : null;

    var lastHtml = lastProps.dangerouslySetInnerHTML && lastProps.dangerouslySetInnerHTML.__html;
    var nextHtml = nextProps.dangerouslySetInnerHTML && nextProps.dangerouslySetInnerHTML.__html;

    // Note the use of `!=` which checks for null or undefined.
    var lastChildren = lastContent != null ? null : lastProps.children;
    var nextChildren = nextContent != null ? null : nextProps.children;

    // If we're switching from children to content/html or vice versa, remove
    // the old content
    var lastHasContentOrHtml = lastContent != null || lastHtml != null;
    var nextHasContentOrHtml = nextContent != null || nextHtml != null;

    if (lastChildren != null && nextChildren == null) {
      this.updateChildren(null, transaction, context);
    } else if (lastHasContentOrHtml && !nextHasContentOrHtml) {
      this.updateTextContent('');
    }

    if (nextContent != null) {
      if (lastContent !== nextContent) {
        this.updateTextContent('' + nextContent);
      }
    } else if (nextHtml != null) {
      if (lastHtml !== nextHtml) {
        this.updateMarkup('' + nextHtml);
      }
    } else if (nextChildren != null) {
      this.updateChildren(nextChildren, transaction, context);
    }
  },

  getNativeNode: function() {
    return getNode(this);
  },

  /**
   * Destroys all event registrations for this instance. Does not remove from
   * the DOM. That must be done by the parent.
   *
   * @internal
   */
  unmountComponent: function(safely) {
    switch (this._tag) {
      case 'iframe':
      case 'object':
      case 'img':
      case 'form':
      case 'video':
      case 'audio':
        var listeners = this._wrapperState.listeners;
        if (listeners) {
          for (var i = 0; i < listeners.length; i++) {
            listeners[i].remove();
          }
        }
        break;
      case 'html':
      case 'head':
      case 'body':
        /**
         * Components like <html> <head> and <body> can't be removed or added
         * easily in a cross-browser way, however it's valuable to be able to
         * take advantage of React's reconciliation for styling and <title>
         * management. So we just document it and throw in dangerous cases.
         */
        invariant(
          false,
          '<%s> tried to unmount. Because of cross-browser quirks it is ' +
          'impossible to unmount some top-level components (eg <html>, ' +
          '<head>, and <body>) reliably and efficiently. To fix this, have a ' +
          'single top-level component that never unmounts render these ' +
          'elements.',
          this._tag
        );
        break;
    }

    this.unmountChildren(safely);
    ReactDOMComponentTree.uncacheNode(this);
    EventPluginHub.deleteAllListeners(this);
    ReactComponentBrowserEnvironment.unmountIDFromEnvironment(this._rootNodeID);
    this._rootNodeID = null;
    this._domID = null;
    this._wrapperState = null;
  },

  getPublicInstance: function() {
    return getNode(this);
  },

};

ReactPerf.measureMethods(ReactDOMComponent.Mixin, 'ReactDOMComponent', {
  mountComponent: 'mountComponent',
  receiveComponent: 'receiveComponent',
});


// 对ReactDOMComponent的原型进行扩展
Object.assign(
  ReactDOMComponent.prototype,
  ReactDOMComponent.Mixin,
  ReactMultiChild.Mixin
);

module.exports = ReactDOMComponent;
