/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactCompositeComponent
 */

'use strict';

var ReactComponentEnvironment = require('ReactComponentEnvironment');
var ReactCurrentOwner = require('ReactCurrentOwner');
var ReactElement = require('ReactElement');
var ReactErrorUtils = require('ReactErrorUtils');
var ReactInstanceMap = require('ReactInstanceMap');
var ReactInstrumentation = require('ReactInstrumentation');
var ReactNodeTypes = require('ReactNodeTypes');
var ReactPerf = require('ReactPerf');
var ReactPropTypeLocations = require('ReactPropTypeLocations');
var ReactPropTypeLocationNames = require('ReactPropTypeLocationNames');
var ReactReconciler = require('ReactReconciler');
var ReactUpdateQueue = require('ReactUpdateQueue');

var emptyObject = require('emptyObject');
var invariant = require('invariant');
var shouldUpdateReactComponent = require('shouldUpdateReactComponent');
var warning = require('warning');

function getDeclarationErrorAddendum(component) {
  var owner = component._currentElement._owner || null;
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

function StatelessComponent(Component) {

}

StatelessComponent.prototype.render = function () {
  var Component = ReactInstanceMap.get(this)._currentElement.type;
  var element = Component(this.props, this.context, this.updater);
  warnIfInvalidElement(Component, element); // 进行警告验证
  return element;
};

function warnIfInvalidElement(Component, element) {
  if (__DEV__) {
    warning(
      element === null || element === false || ReactElement.isValidElement(element),
      '%s(...): A valid React element (or null) must be returned. You may have ' +
      'returned undefined, an array or some other invalid object.',
      Component.displayName || Component.name || 'Component'
    );
  }
};



/* 
    判断是否是类型组件 或 根组件的包装层组件
    react会为类组件加上isReactComponent属性

*/
function shouldConstruct(Component) {
  return Component.prototype && Component.prototype.isReactComponent;
}

/**
 * ------------------ The Life-Cycle of a Composite Component ------------------
 *
 * - constructor: Initialization of state. The instance is now retained.
 *   - componentWillMount
 *   - render
 *   - [children's constructors]
 *     - [children's componentWillMount and render]
 *     - [children's componentDidMount]
 *     - componentDidMount
 *
 *       Update Phases:
 *       - componentWillReceiveProps (only called if parent updated)
 *       - shouldComponentUpdate
 *         - componentWillUpdate
 *           - render
 *           - [children's constructors or receive props phases]
 *         - componentDidUpdate
 *
 *     - componentWillUnmount
 *     - [children's componentWillUnmount]
 *   - [children destroyed]
 * - (destroyed): The instance is now blank, released by React and ready for GC.
 *
 * -----------------------------------------------------------------------------
 */

/**
 * An incrementing ID assigned to each component when it is mounted. This is
 * used to enforce the order in which `ReactUpdates` updates dirty components.
 *
 * @private
 */
var nextMountID = 1;

/**
 * @lends {ReactCompositeComponent.prototype}
 */
var ReactCompositeComponentMixin = {

  /**
   * 所有复合组件的基本构造函数
   * 该函数会进行初始化操作，设置实例的属性
   * @param {ReactElement} element  babel转义后的组件
   * @final
   * @internal
   */
  construct: function (element) {
    this._currentElement = element;  // 将其存到实例的_currentElement属性中
    this._rootNodeID = null;
    this._instance = null;
    this._nativeParent = null;
    this._nativeContainerInfo = null;

    // See ReactUpdateQueue
    this._pendingElement = null;

    // _pendingStateQueue、_pendingReplaceState、_pendingForceUpdate 这三个是用来控制state的更新机制
    this._pendingStateQueue = null;  // 状态队列
    this._pendingReplaceState = false;  // 状态更新
    this._pendingForceUpdate = false;   // 强制更新

    this._renderedNodeType = null;
    this._renderedComponent = null; // 存储render返回的节点组件的初始化实例
    this._context = null;
    this._mountOrder = 0;
    this._topLevelWrapper = null;

    // See ReactUpdates and ReactUpdateQueue.
    this._pendingCallbacks = null;

    // ComponentWillUnmount shall only be called once
    this._calledComponentWillUnmount = false;
  },



  /**
   * 该函数控制组件的渲染阶段
   * @param {*} transaction              事务
   * @param {*} nativeParent             首次执行时为null
   * @param {*} nativeContainerInfo      首次为集装信息，为一个对象，集装信息，主要存储容器和包装后的根组件的一些信息
   * @param {*} context                  上下文
   * @returns 
   */
  mountComponent: function (
    transaction,
    nativeParent,
    nativeContainerInfo,
    context
  ) {

    // this为组件初始化的实例

    this._context = context;   // 将上下文存到实例的_context属性中
    this._mountOrder = nextMountID++;  // 首次执行时为1,存到实例的_mountOrder属性中
    this._nativeParent = nativeParent; // 首次执行时为null，（dom组件初始化实例）存到实例中
    this._nativeContainerInfo = nativeContainerInfo;  // 首次执行时为 集装信息，为一个对象，存储参数的一些信息，存到实例中


    /* 
        直接返回参数
        首次执行时因为根据组件会被包一层，所以首次执行时 props为根组件,经babel转义后的
    */
    var publicProps = this._processProps(this._currentElement.props);

    var publicContext = this._processContext(context); // 首次执行时返回emptyObject

    var Component = this._currentElement.type; // 首次执行时为 TopLevelWrapper函数。


    /* 
          该函数中会new Construct函数,并返回实例
          首次执行时，该Construct函数为TopLevelWrapper函数
          首次执行返回的对象，对象中的属性有
            rootID为1
            原型上的isReactComponent属性为一个对象
            原型上的render属性为一个函数，返回根组件

          
          不是首次执行那么判断是否是类组件如果是那么将返回一个类实例
    
    */
    var inst = this._constructComponent(publicProps, publicContext);

    var renderedElement;

    // 判断是否是无状态组件
    if (!shouldConstruct(Component) && (inst == null || inst.render == null)) {
      renderedElement = inst;
      warnIfInvalidElement(Component, renderedElement); // 该函数会进行警告验证，判断是否要进行警告
    
      inst = new StatelessComponent(Component); // 会创建一个无状态组件
    };

 

    inst.props = publicProps;         // 首次执行时该属性为根组件，否则为传给自定义组件的属性
    inst.context = publicContext;     // 首次执行时该属性为emptyObject
    inst.refs = emptyObject;          // emptyObject
    inst.updater = ReactUpdateQueue;  // 为ReactUpdateQueue模块的ReactUpdateQueue对象  
    /* 
          首次执行时，经过上面的赋值
          inst对象变成了
          {
             rootID:1,
             props: 根组件,
             context: emptyObject,
             refs: emptyObject,
             updater: ReactUpdateQueue模块的ReactUpdateQueue对象,
             原型:{
               isReactComponent:{},
               render(props) =>  props // 返回根组件
             }
          }
    
    */



    this._instance = inst; // 将其添加到组件初始化实例的_instance中


    /* 
       该函数执行完后 inst中拥有_reactInternalInstance属性，该属性为this
    
    */
    ReactInstanceMap.set(inst, this);




    /* 
         首次执行后
         inst对象多一个属性state为null
    */
    var initialState = inst.state; // 首次执行时为undefined
    if (initialState === undefined) {
      inst.state = initialState = null;
    };



    this._pendingStateQueue = null;     // 状态队列, 该属性更新时将是数组，会存储 执行setState的新状态
    this._pendingReplaceState = false;  // 状态更新
    this._pendingForceUpdate = false;   // 强制更新

    var markup;

    // 判断是否有错,首次执行该属性为undefined
    if (inst.unstable_handleError) {
      markup = this.performInitialMountWithErrorHandling(
        renderedElement,
        nativeParent,
        nativeContainerInfo,
        transaction,
        context
      );
    } else {

      /* 
          首次执行时
           renderedElement为undefined
           nativeParent为null
           nativeContainerInfo为集装信息，为一个对象，集装信息，主要存储容器和包装后的根组件的一些信息
           transaction为事务
           context为上下文
      */
      markup = this.performInitialMount(renderedElement, nativeParent, nativeContainerInfo, transaction, context);
    }

    // 判断是否有该生命周期
    if (inst.componentDidMount) {
      transaction.getReactMountReady().enqueue(inst.componentDidMount, inst);
    }

    return markup;
  },


  /**
   * 
   * @param {*} publicProps     首次执行时为根组件
   * @param {*} publicContext   首次执行时为emptyObject
   * @returns 
   */
  _constructComponent: function (publicProps, publicContext) {
    
      return this._constructComponentWithoutOwner(publicProps, publicContext);
  
  },


  /**
   *  
   * @param {*} publicProps      首次执行时为根组件
   * @param {*} publicContext    首次执行时为emptyObject
   * @returns 
   */
  _constructComponentWithoutOwner: function (publicProps, publicContext) {

    /* 
         首次执行时为 TopLevelWrapper函数
    
    */
    var Component = this._currentElement.type;


    /* 
        判断是不是跟组件的包装层，也就是判断是不是TopLevelWrapper函数 或 是否是类组件
        类组件必须继承ReactComponent模块，所以原型上会有isReactComponent属性
    */
    if (shouldConstruct(Component)) {

      return new Component(publicProps, publicContext, ReactUpdateQueue);  // 执行TopLevelWrapper函数，或类组件
      /* 
        首次执行时 new 该TopLevelWrapper函数返回一个实例，该实例包含以下属性
         rootID为1
         原型上的isReactComponent属性为一个对象
         原型上的render属性为函数，该函数返回根组件


        不是首次执行时会返回一个类实例
      
      */

    } else {
      return Component(publicProps, publicContext, ReactUpdateQueue); // 执行自定义函数组件
    }
  },

  
  performInitialMountWithErrorHandling: function (
    renderedElement,
    nativeParent,
    nativeContainerInfo,
    transaction,
    context
  ) {
    var markup;
    var checkpoint = transaction.checkpoint();
    try {
      markup = this.performInitialMount(renderedElement, nativeParent, nativeContainerInfo, transaction, context);
    } catch (e) {

      transaction.rollback(checkpoint);
      this._instance.unstable_handleError(e);
      if (this._pendingStateQueue) {
        this._instance.state = this._processPendingState(this._instance.props, this._instance.context);
      }
      checkpoint = transaction.checkpoint();

      this._renderedComponent.unmountComponent(true);
      transaction.rollback(checkpoint);


      markup = this.performInitialMount(renderedElement, nativeParent, nativeContainerInfo, transaction, context);
    }
    return markup;
  },



  /**
   * 执行初始装载
   * @param {*} renderedElement       首次执行时为undefined
   * @param {*} nativeParent          首次执行时为null
   * @param {*} nativeContainerInfo   集装信息，为一个对象，集装信息，主要存储容器和包装后的根组件的一些信息
   * @param {*} transaction           事务
   * @param {*} context               上下文
   * @returns 
   */
  performInitialMount: function (renderedElement, nativeParent, nativeContainerInfo, transaction, context) {
    /* 
         首次执行时为 new TopLevelWrapper 返回的对象
         该对象经过mountComponent函数的操作后变成
         {
             rootID:1,
             props: 根组件,
             context: emptyObject,
             refs: emptyObject,
             updater: ReactUpdateQueue模块的ReactUpdateQueue对象,
             state: null,
             _reactInternalInstance: this
             原型:{
               isReactComponent:{},
               render(props) =>  props // 返回根组件
             }
          }
    
    */
    var inst = this._instance;



    /* 
        判断是否有该生命周期
        因为首次执行时inst对象为 new TopLevelWrapper函数返回的对象，所以首次时没有该生命周期
    
    */
    if (inst.componentWillMount) {

      inst.componentWillMount(); //执行生命周期

      // 判断是否需要更新状态
      if (this._pendingStateQueue) { 
        inst.state = this._processPendingState(inst.props, inst.context); // 更新状态
      }
    }


    /* 
        首次执行时该属性为 undefined
    */
    if (renderedElement === undefined) {
      /* 
          首次执行时返回根组件
      */
      renderedElement = this._renderValidatedComponent();
    }


    /* 
         获取子节点的类型，但首次执行时是根节点，因为根节点被ReactElement包装多一层
         并且将子节点类型添加到组件初始化实例的_renderedNodeType属性中
         返回值
           空节点为    0
           组件节点为  1
           标签节点为  2
         
    */
    this._renderedNodeType = ReactNodeTypes.getType(renderedElement);


    /* 
        初始化子节点，并将初始化子节点的实例，赋值到_renderedComponent属性上
    */
    this._renderedComponent = this._instantiateReactComponent(
      renderedElement
    );


    // 进行递归渲染子节点
    var markup = ReactReconciler.mountComponent(
      this._renderedComponent,  // 初始化子节点的实例
      transaction,              // 事务
      nativeParent,             // 首次执行时为null
      nativeContainerInfo,      // 集装的一些参数信息
      this._processChildContext(context)  // 上下文
    );

    return markup;
  },


  
  getNativeNode: function () {
    return ReactReconciler.getNativeNode(this._renderedComponent);
  },

  /**
   * 卸载组件
   * @param {*} safely  布尔值， 一般都为false
   * @returns 
   */
  unmountComponent: function (safely) {
     // 没有render返回的节点组件的初始化实例，则直接结束
    if (!this._renderedComponent) {
      return;
    }
    var inst = this._instance; // 获取 new 函数的实例

    // 判断有没有该生命周期
    if (inst.componentWillUnmount && !inst._calledComponentWillUnmount) {
      inst._calledComponentWillUnmount = true;
      if (safely) {
        var name = this.getName() + '.componentWillUnmount()';
        ReactErrorUtils.invokeGuardedCallback(name, inst.componentWillUnmount.bind(inst));
      } else {
        inst.componentWillUnmount(); // 执行生命周期
      }
    }

    
    // 判断有没有render返回的节点组件的初始化实例
    if (this._renderedComponent) {
      ReactReconciler.unmountComponent(this._renderedComponent, safely); // 卸载render返回的节点组件的初始化实例
      this._renderedNodeType = null;
      this._renderedComponent = null;
      this._instance = null;
    }

    // Reset pending fields
    // Even if this component is scheduled for another update in ReactUpdates,
    // it would still be ignored because these fields are reset.
    this._pendingStateQueue = null;
    this._pendingReplaceState = false;
    this._pendingForceUpdate = false;
    this._pendingCallbacks = null;
    this._pendingElement = null;

    // These fields do not really need to be reset since this object is no
    // longer accessible.
    this._context = null;
    this._rootNodeID = null;
    this._topLevelWrapper = null;

    // Delete the reference from the instance to this internal representation
    // which allow the internals to be properly cleaned up even if the user
    // leaks a reference to the public instance.
    ReactInstanceMap.remove(inst);

    // Some existing components rely on inst.props even after they've been
    // destroyed (in event handlers).
    // TODO: inst.props = null;
    // TODO: inst.state = null;
    // TODO: inst.context = null;
  },

  /**
   *
   * @param {object} context   上下文
   * @return {?object}  重新赋值后的上下文
   * @private
   */
  _maskContext: function (context) {
    var Component = this._currentElement.type; // 函数,首次时为TopLevelWrapper函数

    var contextTypes = Component.contextTypes; // 函数的类型，首次时为undefined

    if (!contextTypes) {
      return emptyObject;  // 如果没有，则直接返回 emptyObject对象
    }

    var maskedContext = {};

    // 遍历该类型
    for (var contextName in contextTypes) {
      maskedContext[contextName] = context[contextName]; // 将该上下文中的属性赋值到另一个对象中
    }

    return maskedContext; // 返回该新对象
  },

  /**
   * @param {object} context  上下文
   * @return {?object}
   * @private
   */
  _processContext: function (context) {
    var maskedContext = this._maskContext(context); // 首次执行时返回 emptyObject，或者直接浅复制一份返回

    return maskedContext;
  },

  /**
   * @param {object} currentContext  上下文
   * @return {object}
   * @private
   */
  _processChildContext: function (currentContext) {
    var Component = this._currentElement.type; // 获取组件函数
    var inst = this._instance; // 获取 new 函数 返回的实例
   
    var childContext = inst.getChildContext && inst.getChildContext();
   
    if (childContext) {
      
      for (var name in childContext) {
        invariant(
          name in Component.childContextTypes,
          '%s.getChildContext(): key "%s" is not defined in childContextTypes.',
          this.getName() || 'ReactCompositeComponent',
          name
        );
      }
      return Object.assign({}, currentContext, childContext);
    }
    return currentContext;
  },

  /**
   *
   * @param {object} newProps   属性
   * @return {object}
   * @private
   */
  _processProps: function (newProps) {
  
    return newProps;
  },

  /**
   * Assert that the props are valid
   *
   * @param {object} propTypes Map of prop name to a ReactPropType
   * @param {object} props
   * @param {string} location e.g. "prop", "context", "child context"
   * @private
   */
  _checkPropTypes: function (propTypes, props, location) {
    // TODO: Stop validating prop types here and only use the element
    // validation.
    var componentName = this.getName();
    for (var propName in propTypes) {
      if (propTypes.hasOwnProperty(propName)) {
        var error;
        try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
          invariant(
            typeof propTypes[propName] === 'function',
            '%s: %s type `%s` is invalid; it must be a function, usually ' +
            'from React.PropTypes.',
            componentName || 'React class',
            ReactPropTypeLocationNames[location],
            propName
          );
          error = propTypes[propName](props, propName, componentName, location);
        } catch (ex) {
          error = ex;
        }
        if (error instanceof Error) {
          // We may want to extend this logic for similar errors in
          // top-level render calls, so I'm abstracting it away into
          // a function to minimize refactoring in the future
          var addendum = getDeclarationErrorAddendum(this);

          if (location === ReactPropTypeLocations.prop) {
            // Preface gives us something to blacklist in warning module
            warning(
              false,
              'Failed Composite propType: %s%s',
              error.message,
              addendum
            );
          } else {
            warning(
              false,
              'Failed Context Types: %s%s',
              error.message,
              addendum
            );
          }
        }
      }
    }
  },

  /**
   * 更新组件
   * @param {*} nextElement 新元素 为babel转义后的函数
   * @param {*} transaction 事务
   * @param {*} nextContext 上下文
   */
  receiveComponent: function (nextElement, transaction, nextContext) {
    var prevElement = this._currentElement; // 旧元素
    var prevContext = this._context;  // 旧上下文

    this._pendingElement = null;

    // 调用更新组件          事务        旧元素        新元素        旧上下文     新上下文
    this.updateComponent(transaction, prevElement, nextElement, prevContext, nextContext);
  },

  

  /**
   * 更新组件, 通过执行setState，从而最终执行该函数的
   * @param {ReactReconcileTransaction} transaction  事务
   * @internal
   */
  performUpdateIfNecessary: function (transaction) {

    // 判断是否该属性有值
    if (this._pendingElement != null) {
      ReactReconciler.receiveComponent(
        this,
        this._pendingElement,
        transaction,
        this._context
      );
    };


    /* 
       因为受setState函数的操作该_pendingStateQueue属性将是数组并且存储值新状态
       _pendingForceUpdate 表示是否强制更新


       更新后 实例的_pendingStateQueue属性会被重新赋值为空，所以多次setState不会触发多次更新
    */
    if (this._pendingStateQueue !== null || this._pendingForceUpdate) {

      // 更新组件
      this.updateComponent(
        transaction,  // 事务
        this._currentElement, // babel转义后的组件
        this._currentElement, 
        this._context,  // 上下文
        this._context
      );
    }
  },


  /**
   * 更新组件
   * @param {*} transaction            事务
   * @param {*} prevParentElement      旧babel转义
   * @param {*} nextParentElement      新babel转义
   * @param {*} prevUnmaskedContext    旧上下文
   * @param {*} nextUnmaskedContext    新上下文
   */
  updateComponent: function (
    transaction,  // 事务
    prevParentElement,  // 旧元素
    nextParentElement,  // 新元素
    prevUnmaskedContext,// 旧上下文
    nextUnmaskedContext // 新上下文
  ) {

    var inst = this._instance; // 获取组件new的实例
    var willReceive = false; // 是否为新的
    var nextContext;  // 要存储新上下文的变量
    var nextProps;    // 要存储旧属性的变量



    // 判断是否同一个上下文，如果是调用setState函数的这个组件，则上下文为同一个
    if (this._context === nextUnmaskedContext) {

      nextContext = inst.context; // 为同一个上下文

    } else {

      nextContext = this._processContext(nextUnmaskedContext); // 返回一份浅复制的上下文类型对象
      willReceive = true; // 表示有新的上下文

    };


    // 判断元素是否一致，如果是调用setState函数的这个组件，则属性为同一个
    if (prevParentElement === nextParentElement) {

      nextProps = nextParentElement.props;  // 获取属性

    } else {

      nextProps = this._processProps(nextParentElement.props);  // 获取新的属性
      willReceive = true; // 表示有新的属性

    }

    /* 
       判断是否是新组件，并且该组件有该生命周期 componentWillReceiveProps。
       也就是只有属性变化或上下文变化时才会执行该生命周期
    */
    if (willReceive && inst.componentWillReceiveProps) {
      // 该生命周期只有props改变或上下文不同时才会执行

      //                              新属性      新上下文
      inst.componentWillReceiveProps(nextProps, nextContext); // 执行生命周期函数
    }
    

    /* 
       该函数会将每一次setState执行时传递的数据进行混入后返回
       如果状态队列中只有一个新状态，则返回该新状态
       如果状态队列中有多个新状态，则进行混合后返回

    */
    var nextState = this._processPendingState(nextProps, nextContext); 

    
    //  判断是否有该 shouldComponentUpdate 生命周期，如果有那么将执行并将返回值存到变量中                           新属性     新状态      新上下文                                
    var shouldUpdate = this._pendingForceUpdate || !inst.shouldComponentUpdate || inst.shouldComponentUpdate(nextProps, nextState, nextContext);
    //  如果没有该生命周期，则将返回true, 并存到变量中



    /* 
        会根据shouldComponentUpdate生命周期返回的布尔值来判断是否需要重新渲染
    */
    if (shouldUpdate) {
      this._pendingForceUpdate = false; // 将强制更新赋为false

      // 更新组件
      this._performComponentUpdate(
        nextParentElement,  // 新元素 （babel转义）
        nextProps,          // 新属性
        nextState,          // 新状态
        nextContext,        // 新上下文 ---- 浅复制一份的上下文类型对象
        transaction,        // 事务
        nextUnmaskedContext // 新上下文
      );
    } else {
      // 不用重新渲染组件 --- 更新属性、元素、状态、上下文


      this._currentElement = nextParentElement;  // 新元素 babel转义后的函数组件
      this._context = nextUnmaskedContext;  // 新上下文
      inst.props = nextProps;  // 新属性
      inst.state = nextState;  // 新状态
      inst.context = nextContext; // 新上下文 --- 浅复制一份的上下文类型对象
    }
  },

  
  /**
   * 
   * @param {*} props 属性对象
   * @param {*} context 上下文对象
   * @returns 
   */
  _processPendingState: function (props, context) {

    var inst = this._instance; // 该属性为 new 类组件返回的this实例
    var queue = this._pendingStateQueue; // 获取存储的新状态数据的数组
    var replace = this._pendingReplaceState; // 执行setState更新时该属性会被赋值为true
    this._pendingReplaceState = false; // 重新修改为false
    this._pendingStateQueue = null; // 将状态队列赋为空


    // 如果没有新状态，则直接返回旧状态
    if (!queue) {
      return inst.state;
    };


    // 判断是否该实例只执行一个setState
    if (replace && queue.length === 1) {
      return queue[0]; // 直接返回第一项
    };


    /* 
        将第一个执行setState函数的参数状态，混进空对象返回
    */
    var nextState = Object.assign({}, replace ? queue[0] : inst.state);


    // 循环存储新状态的数组
    for (var i = replace ? 1 : 0; i < queue.length; i++) {
      var partial = queue[i]; // 获取存储的每一项新状态

      // 进行混入
      Object.assign(
        nextState,
        typeof partial === 'function' ? partial.call(inst, nextState, props, context) : partial
      );
    }

    return nextState; // 将混入后的对象返回
  },




  /**
   * 更新组件
   * @param {ReactElement} nextElement 新元素 babel转义后的组件函数
   * @param {object} nextProps 新属性
   * @param {?object} nextState 新状态
   * @param {?object} nextContext 新上下文 ---- 复制一份的上下文类型对象
   * @param {ReactReconcileTransaction} transaction  事务
   * @param {?object} unmaskedContext 新上下文
   * @private
   */
  _performComponentUpdate: function (
    nextElement,
    nextProps,
    nextState,
    nextContext,
    transaction,
    unmaskedContext
  ) {
    var inst = this._instance; // 获取 new 组件是的this实例

    var hasComponentDidUpdate = Boolean(inst.componentDidUpdate); // 判断是否有该生命周期

    // 声明这些变量来存储旧的 属性、状态、上下文
    var prevProps;
    var prevState;
    var prevContext;

    // 判断是否有该生命周期componentDidUpdate
    if (hasComponentDidUpdate) {
      prevProps = inst.props;     // 存储旧属性
      prevState = inst.state;     // 存储旧状态
      prevContext = inst.context; // 存储旧上下文
    };

    // 判断是否有该生命周期
    if (inst.componentWillUpdate) {
      //                        新属性      新状态     新上下文
      inst.componentWillUpdate(nextProps, nextState, nextContext);  // 执行该生命周期,属性更新前执行
    };


    this._currentElement = nextElement;  // 更新存储babel转义后的组件
    this._context = unmaskedContext;     // 更新存储新上下文
    inst.props = nextProps;              // 更新存储新属性
    inst.state = nextState;              // 更新存储新状态
    inst.context = nextContext;          // 更新存储新上下文 --- 复制一份新的上下文类型对象
    // 上面这些赋值完后，组件的属性、状态已更新


    // 该函数中会进行更新组件操作      事务         新上下文
    this._updateRenderedComponent(transaction, unmaskedContext);


    // 判断是否有该生命周期函数
    if (hasComponentDidUpdate) {
      transaction.getReactMountReady().enqueue(
        inst.componentDidUpdate.bind(inst, prevProps, prevState, prevContext),
        inst
      );
    }
  },



  
  /**
   * 更新渲染组件
   * @param {ReactReconcileTransaction} transaction  事务
   * @param {Object} context  新上下文
   * @internal
   */
  _updateRenderedComponent: function (transaction, context) {

    var prevComponentInstance = this._renderedComponent; // 获取子节点的组件的初始化实例

    var prevRenderedElement = prevComponentInstance._currentElement; // babel转义后子节点组件

    //该函数会调用组件的render函数，获取返回值
    var nextRenderedElement = this._renderValidatedComponent();  // 获取新的render返回值


    /* 
         参数为 旧子组件  新子组件
         该函数会判断
           新旧子组件是否有某一方为空或false，就判断新旧是否相等并返回
           或 新旧子组件是否是文本并且相同
           或 新旧子组件 类型和key 是否相同           
        
          相同（小更新）和不同（大更新，因为不相同就要进行卸载后重新创建）都要进行组件更新
    */
    if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {

      // 会对子节点进行判断更新
      ReactReconciler.receiveComponent(
        prevComponentInstance,  // 子节点的组件的初始化实例
        nextRenderedElement,    // 子节点的组件 （babel转义后的）
        transaction,            // 事务
        this._processChildContext(context) // 获取处理后的上下文
      );

    } else { // 新旧节点发生变化的情况下
     
      //                                                   旧子组件初始化实例
      var oldNativeNode = ReactReconciler.getNativeNode(prevComponentInstance); // 获取旧dom节点

      ReactReconciler.unmountComponent(prevComponentInstance, false); // 卸载render返回组件节点

      this._renderedNodeType = ReactNodeTypes.getType(nextRenderedElement); // 获取新节点的类型


      //重新对组件进行入口的初始化，并替换类组件的该属性值
      this._renderedComponent = this._instantiateReactComponent(
        nextRenderedElement
      );  


      // 渲染组件，该函数中会进行递归渲染  并返回一个LazyTree对象
      var nextMarkup = ReactReconciler.mountComponent(
        this._renderedComponent,  // 子组件初始化实例
        transaction,  // 事务
        this._nativeParent,  // 父节点
        this._nativeContainerInfo,  // 集装信息对象
        this._processChildContext(context)  // 上下文
      );

      /* 
         
           
          参数为  旧dom节点 、LazyTree对象
      */
      this._replaceNodeWithMarkup(oldNativeNode, nextMarkup);
    };
    
  },

  /**
   * 在浅层渲染中覆盖。
   *
   * @protected
   */
  _replaceNodeWithMarkup: function (oldNativeNode, nextMarkup) {
    ReactComponentEnvironment.replaceNodeWithMarkup(
      oldNativeNode,
      nextMarkup
    );
  },

  /**
   * @protected
   */
  _renderValidatedComponentWithoutOwnerOrContext: function () {

    /* 
        首次执行时组件初始化实例中该_instance属性为 new TopLevelWrapper函数返回的对象
          首次时该对象为
          {
             rootID:1,
             props: 根组件,
             context: emptyObject,
             refs: emptyObject,
             updater: ReactUpdateQueue模块的ReactUpdateQueue对象,
             state: null,
             _reactInternalInstance: this
             原型:{
               isReactComponent:{},
               render(props) =>  props // 返回根组件
             }
          }
    
    */
    var inst = this._instance; // 获取存储的babel转义的组件



    /* 
         首次时执行时返回根组件
         除首次外，将返回函数的返回值
    
    */
    var renderedComponent = inst.render();

  

    return renderedComponent;
  },

  /**
   * 渲染组件
   * @private
   */
  _renderValidatedComponent: function () {

    var renderedComponent;

    // 将该对象中的current属性置为 组件初始化的实例，存储当前正在处理的组件
    ReactCurrentOwner.current = this;  


    // 捕获错误
    try {

      /* 
          首次执行时renderedComponent为根组件

            返回的render函数的返回值
      
      */
      renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();

    } finally {

      ReactCurrentOwner.current = null;  // 将该对象中的current属性还原为 null, 处理完毕后将其置空

    }



    return renderedComponent;  // 首次执行时返回根组件，如果不是首次执行那么返回render函数的返回值
  },

  /**
   * Lazily allocates the refs object and stores `component` as `ref`.
   *
   * @param {string} ref Reference name.
   * @param {component} component Component to store as `ref`.
   * @final
   * @private
   */
  attachRef: function (ref, component) {
    var inst = this.getPublicInstance();
    invariant(inst != null, 'Stateless function components cannot have refs.');
    var publicComponentInstance = component.getPublicInstance();
    if (__DEV__) {
      var componentName = component && component.getName ?
        component.getName() : 'a component';
      warning(publicComponentInstance != null,
        'Stateless function components cannot be given refs ' +
        '(See ref "%s" in %s created by %s). ' +
        'Attempts to access this ref will fail.',
        ref,
        componentName,
        this.getName()
      );
    }
    var refs = inst.refs === emptyObject ? (inst.refs = {}) : inst.refs;
    refs[ref] = publicComponentInstance;
  },

  /**
   * Detaches a reference name.
   *
   * @param {string} ref Name to dereference.
   * @final
   * @private
   */
  detachRef: function (ref) {
    var refs = this.getPublicInstance().refs;
    delete refs[ref];
  },

  /**
   * Get a text description of the component that can be used to identify it
   * in error messages.
   * @return {string} The name or null.
   * @internal
   */
  getName: function () {
    var type = this._currentElement.type;
    var constructor = this._instance && this._instance.constructor;
    return (
      type.displayName || (constructor && constructor.displayName) ||
      type.name || (constructor && constructor.name) ||
      null
    );
  },

  /**
   * Get the publicly accessible representation of this component - i.e. what
   * is exposed by refs and returned by render. Can be null for stateless
   * components.
   *
   * @return {ReactComponent} the public component instance.
   * @internal
   */
  getPublicInstance: function () {
    var inst = this._instance;
    if (inst instanceof StatelessComponent) {
      return null;
    }
    return inst;
  },

  //因为对 ReactCompositeComponentWrapper函数的原型进行扩展时，增加了该instantiateReactComponent
  _instantiateReactComponent: null,

};

ReactPerf.measureMethods(
  ReactCompositeComponentMixin,
  'ReactCompositeComponent',
  {
    mountComponent: 'mountComponent',
    updateComponent: 'updateComponent',
    _renderValidatedComponent: '_renderValidatedComponent',
  }
);

var ReactCompositeComponent = {

  Mixin: ReactCompositeComponentMixin,

};

module.exports = ReactCompositeComponent;
