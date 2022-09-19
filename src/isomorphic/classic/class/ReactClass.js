/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactClass
 */

'use strict';

var ReactComponent = require('ReactComponent');
var ReactElement = require('ReactElement');
var ReactPropTypeLocations = require('ReactPropTypeLocations');
var ReactPropTypeLocationNames = require('ReactPropTypeLocationNames');
var ReactNoopUpdateQueue = require('ReactNoopUpdateQueue');

var emptyObject = require('emptyObject');
var invariant = require('invariant');
var keyMirror = require('keyMirror');
var keyOf = require('keyOf');
var warning = require('warning');

var MIXINS_KEY = keyOf({ mixins: null }); // 该函数内部会遍历参数对象，并判断参数对象里的属性是否不是原型上的，如果不是则返回
/* 
源码
function (oneKeyObj) {
  var key;
  for (key in oneKeyObj) {
    if (!oneKeyObj.hasOwnProperty(key)) {
      continue;
    }
    return key;
  }
  return null;
};


*/

/**
 * Policies that describe methods in `ReactClassInterface`.
 * 重要的配置属性以及生命周期，默认值
 */
var SpecPolicy = keyMirror({
  /**
   * These methods may be defined only once by the class specification or mixin.
   */
  DEFINE_ONCE: null,
  /**
   * These methods may be defined by both the class specification and mixins.
   * Subsequent definitions will be chained. These methods must return void.
   */
  DEFINE_MANY: null,
  /**
   * These methods are overriding the base class.
   */
  OVERRIDE_BASE: null,
  /**
   * These methods are similar to DEFINE_MANY, except we assume they return
   * objects. We try to merge the keys of the return values of all the mixed in
   * functions. If there is a key conflict we throw.
   */
  DEFINE_MANY_MERGED: null,
});


var injectedMixins = [];

/**
 * 生命周期，值都为null，要该对象功能主要是用于辅助验证
 * @interface ReactClassInterface
 * @internal
 */
var ReactClassInterface = {

  /**
   * An array of Mixin objects to include when defining your component.
   *
   * @type {array}
   * @optional
   */
  mixins: SpecPolicy.DEFINE_MANY,

  /**
   * An object containing properties and methods that should be defined on
   * the component's constructor instead of its prototype (static methods).
   *
   * @type {object}
   * @optional
   */
  statics: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of prop types for this component.
   *
   * @type {object}
   * @optional
   */
  propTypes: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of context types for this component.
   *
   * @type {object}
   * @optional
   */
  contextTypes: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of context types this component sets for its children.
   *
   * @type {object}
   * @optional
   */
  childContextTypes: SpecPolicy.DEFINE_MANY,

  // ==== Definition methods ====

  /**
   * Invoked when the component is mounted. Values in the mapping will be set on
   * `this.props` if that prop is not specified (i.e. using an `in` check).
   *
   * This method is invoked before `getInitialState` and therefore cannot rely
   * on `this.state` or use `this.setState`.
   *
   * @return {object}
   * @optional
   */
  getDefaultProps: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * Invoked once before the component is mounted. The return value will be used
   * as the initial value of `this.state`.
   *
   *   getInitialState: function() {
   *     return {
   *       isOn: false,
   *       fooBaz: new BazFoo()
   *     }
   *   }
   *
   * @return {object}
   * @optional
   */
  getInitialState: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * @return {object}
   * @optional
   */
  getChildContext: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * Uses props from `this.props` and state from `this.state` to render the
   * structure of the component.
   *
   * No guarantees are made about when or how often this method is invoked, so
   * it must not have side effects.
   *
   *   render: function() {
   *     var name = this.props.name;
   *     return <div>Hello, {name}!</div>;
   *   }
   *
   * @return {ReactComponent}
   * @nosideeffects
   * @required
   */
  render: SpecPolicy.DEFINE_ONCE,



  // ==== Delegate methods ====

  /**
   * Invoked when the component is initially created and about to be mounted.
   * This may have side effects, but any external subscriptions or data created
   * by this method must be cleaned up in `componentWillUnmount`.
   *
   * @optional
   */
  componentWillMount: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component has been mounted and has a DOM representation.
   * However, there is no guarantee that the DOM node is in the document.
   *
   * Use this as an opportunity to operate on the DOM when the component has
   * been mounted (initialized and rendered) for the first time.
   *
   * @param {DOMElement} rootNode DOM element representing the component.
   * @optional
   */
  componentDidMount: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked before the component receives new props.
   *
   * Use this as an opportunity to react to a prop transition by updating the
   * state using `this.setState`. Current props are accessed via `this.props`.
   *
   *   componentWillReceiveProps: function(nextProps, nextContext) {
   *     this.setState({
   *       likesIncreasing: nextProps.likeCount > this.props.likeCount
   *     });
   *   }
   *
   * NOTE: There is no equivalent `componentWillReceiveState`. An incoming prop
   * transition may cause a state change, but the opposite is not true. If you
   * need it, you are probably looking for `componentWillUpdate`.
   *
   * @param {object} nextProps
   * @optional
   */
  componentWillReceiveProps: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked while deciding if the component should be updated as a result of
   * receiving new props, state and/or context.
   *
   * Use this as an opportunity to `return false` when you're certain that the
   * transition to the new props/state/context will not require a component
   * update.
   *
   *   shouldComponentUpdate: function(nextProps, nextState, nextContext) {
   *     return !equal(nextProps, this.props) ||
   *       !equal(nextState, this.state) ||
   *       !equal(nextContext, this.context);
   *   }
   *
   * @param {object} nextProps
   * @param {?object} nextState
   * @param {?object} nextContext
   * @return {boolean} True if the component should update.
   * @optional
   */
  shouldComponentUpdate: SpecPolicy.DEFINE_ONCE,

  /**
   * Invoked when the component is about to update due to a transition from
   * `this.props`, `this.state` and `this.context` to `nextProps`, `nextState`
   * and `nextContext`.
   *
   * Use this as an opportunity to perform preparation before an update occurs.
   *
   * NOTE: You **cannot** use `this.setState()` in this method.
   *
   * @param {object} nextProps
   * @param {?object} nextState
   * @param {?object} nextContext
   * @param {ReactReconcileTransaction} transaction
   * @optional
   */
  componentWillUpdate: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component's DOM representation has been updated.
   *
   * Use this as an opportunity to operate on the DOM when the component has
   * been updated.
   *
   * @param {object} prevProps
   * @param {?object} prevState
   * @param {?object} prevContext
   * @param {DOMElement} rootNode DOM element representing the component.
   * @optional
   */
  componentDidUpdate: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component is about to be removed from its parent and have
   * its DOM representation destroyed.
   *
   * Use this as an opportunity to deallocate any external resources.
   *
   * NOTE: There is no `componentDidUnmount` since your component will have been
   * destroyed by that point.
   *
   * @optional
   */
  componentWillUnmount: SpecPolicy.DEFINE_MANY,



  // ==== Advanced methods ====

  /**
   * Updates the component's currently mounted DOM representation.
   *
   * By default, this implements React's rendering and reconciliation algorithm.
   * Sophisticated clients may wish to override this.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   * @overridable
   */
  updateComponent: SpecPolicy.OVERRIDE_BASE,

};

/**
 * 是否是重要的配置属性
 */
var RESERVED_SPEC_KEYS = {
  displayName: function (Constructor, displayName) {
    Constructor.displayName = displayName;
  },
  mixins: function (Constructor, mixins) {
    if (mixins) {
      for (var i = 0; i < mixins.length; i++) {
        mixSpecIntoComponent(Constructor, mixins[i]);
      }
    }
  },
  childContextTypes: function (Constructor, childContextTypes) {
    if (__DEV__) {
      validateTypeDef(
        Constructor,
        childContextTypes,
        ReactPropTypeLocations.childContext
      );
    }
    Constructor.childContextTypes = Object.assign(
      {},
      Constructor.childContextTypes,
      childContextTypes
    );
  },
  contextTypes: function (Constructor, contextTypes) {
    if (__DEV__) {
      validateTypeDef(
        Constructor,
        contextTypes,
        ReactPropTypeLocations.context
      );
    }
    Constructor.contextTypes = Object.assign(
      {},
      Constructor.contextTypes,
      contextTypes
    );
  },
  /**
   * Special case getDefaultProps which should move into statics but requires
   * automatic merging.
   */
  getDefaultProps: function (Constructor, getDefaultProps) {
    if (Constructor.getDefaultProps) {
      Constructor.getDefaultProps = createMergedResultFunction(
        Constructor.getDefaultProps,
        getDefaultProps
      );
    } else {
      Constructor.getDefaultProps = getDefaultProps;
    }
  },
  propTypes: function (Constructor, propTypes) {
    if (__DEV__) {
      validateTypeDef(
        Constructor,
        propTypes,
        ReactPropTypeLocations.prop
      );
    }
    Constructor.propTypes = Object.assign(
      {},
      Constructor.propTypes,
      propTypes
    );
  },
  statics: function (Constructor, statics) {
    mixStaticSpecIntoComponent(Constructor, statics);
  },
  autobind: function () { }, // noop
};

function validateTypeDef(Constructor, typeDef, location) {
  for (var propName in typeDef) {
    if (typeDef.hasOwnProperty(propName)) {
      // use a warning instead of an invariant so components
      // don't show up in prod but only in __DEV__
      warning(
        typeof typeDef[propName] === 'function',
        '%s: %s type `%s` is invalid; it must be a function, usually from ' +
        'React.PropTypes.',
        Constructor.displayName || 'ReactClass',
        ReactPropTypeLocationNames[location],
        propName
      );
    }
  }
}

function validateMethodOverride(isAlreadyDefined, name) {

  // 判断是否是重要的配置属性及生命周期
  var specPolicy = ReactClassInterface.hasOwnProperty(name) ?
    ReactClassInterface[name] :
    null;

  // Disallow overriding of base class methods unless explicitly allowed.
  if (ReactClassMixin.hasOwnProperty(name)) {
    invariant(
      specPolicy === SpecPolicy.OVERRIDE_BASE,
      'ReactClassInterface: You are attempting to override ' +
      '`%s` from your class specification. Ensure that your method names ' +
      'do not overlap with React methods.',
      name
    );
  }

  // Disallow defining methods more than once unless explicitly allowed.
  if (isAlreadyDefined) {
    invariant(
      specPolicy === SpecPolicy.DEFINE_MANY ||
      specPolicy === SpecPolicy.DEFINE_MANY_MERGED,
      'ReactClassInterface: You are attempting to define ' +
      '`%s` on your component more than once. This conflict may be due ' +
      'to a mixin.',
      name
    );
  }
}

/**
 * 进行处理策略验证。
 * 构建react Class类时的规范
 * @param { Function }  函数
 * @param { Object }  配置对象
 */
function mixSpecIntoComponent(Constructor, spec) {
  // 如果没有配置对象则直接结束
  if (!spec) {
    return;
  }

  invariant(
    typeof spec !== 'function',
    'ReactClass: You\'re attempting to ' +
    'use a component class or function as a mixin. Instead, just use a ' +
    'regular object.'
  );
  invariant( 
    !ReactElement.isValidElement(spec),
    'ReactClass: You\'re attempting to ' +
    'use a component as a mixin. Instead, just use a regular object.'
  );

  var proto = Constructor.prototype; // 获取原型对象
  var autoBindPairs = proto.__reactAutoBindPairs; // 获取原型对象的__reactAutoBindPairs数组

  // 判断配置对象里有没有mixins这个属性
  if (spec.hasOwnProperty(MIXINS_KEY)) {
    RESERVED_SPEC_KEYS.mixins(Constructor, spec.mixins); // 进行处理混入，将其混进Constructor函数原型上
  }

  // 遍历配置对象
  for (var name in spec) {
    // 如果该属性是配置对象原型上则跳过
    if (!spec.hasOwnProperty(name)) {
      continue;
    }

    // 该属性是否是mixins，如果是则跳过
    if (name === MIXINS_KEY) {
      continue;
    }

    var property = spec[name]; // 获取属性值
    var isAlreadyDefined = proto.hasOwnProperty(name); // 判断函数原型对象上是否拥有该属性
    validateMethodOverride(isAlreadyDefined, name);  // 配置对象上的属性与函数原型上的起冲突，则进行处理

    // 判断是否是重要的配置属性， 如 displayName、getDefaultProps等
    if (RESERVED_SPEC_KEYS.hasOwnProperty(name)) {
      RESERVED_SPEC_KEYS[name](Constructor, property); // 如果是则进行设置处理
    } else {

      var isReactClassMethod = ReactClassInterface.hasOwnProperty(name); // 判断是否是生命周期


      var isFunction = typeof property === 'function'; // 判断该属性是否是函数

      var shouldAutoBind =
        isFunction &&
        !isReactClassMethod &&
        !isAlreadyDefined &&
        spec.autobind !== false; // 判断该属性是否是函数，但不是生命周期并且函数原型对象函数没有该属性

      // 该属性函数，但不是生命周期并且函数原型对象函数没有该属性
      if (shouldAutoBind) {
        autoBindPairs.push(name, property); // 将其push进__reactAutoBindPairs数组，后面将对象函数进行this绑定
        proto[name] = property; // 赋值在原型对象上
      } else {
        // 判断该属性，函数原型上的是否拥有
        if (isAlreadyDefined) {
          var specPolicy = ReactClassInterface[name]; // 获取生命周期，默认的，不是配置对象的

          
          invariant(
            isReactClassMethod && (
              specPolicy === SpecPolicy.DEFINE_MANY_MERGED ||
              specPolicy === SpecPolicy.DEFINE_MANY
            ),
            'ReactClass: Unexpected spec policy %s for key %s ' +
            'when mixing in component specs.',
            specPolicy,
            name
          );

         
          if (specPolicy === SpecPolicy.DEFINE_MANY_MERGED) {
            proto[name] = createMergedResultFunction(proto[name], property); //对这两个函数进行合并成为一个，并绑定this
          } else if (specPolicy === SpecPolicy.DEFINE_MANY) {
            proto[name] = createChainedFunction(proto[name], property); // 对这两个函数进行合并成为一个，并绑定this
          }
        } else {
          proto[name] = property; // 直接赋值在原型上，生命周期也直接赋值上去

          // 开发环境对其函数设置静态属性
          if (__DEV__) {
            if (typeof property === 'function' && spec.displayName) {
              proto[name].displayName = spec.displayName + '_' + name;
            }
          }
        }
      }
    }
  }
}

function mixStaticSpecIntoComponent(Constructor, statics) {
  if (!statics) {
    return;
  }
  for (var name in statics) {
    var property = statics[name];
    if (!statics.hasOwnProperty(name)) {
      continue;
    }

    var isReserved = name in RESERVED_SPEC_KEYS;
    invariant(
      !isReserved,
      'ReactClass: You are attempting to define a reserved ' +
      'property, `%s`, that shouldn\'t be on the "statics" key. Define it ' +
      'as an instance property instead; it will still be accessible on the ' +
      'constructor.',
      name
    );

    var isInherited = name in Constructor;
    invariant(
      !isInherited,
      'ReactClass: You are attempting to define ' +
      '`%s` on your component more than once. This conflict may be ' +
      'due to a mixin.',
      name
    );
    Constructor[name] = property;
  }
}

/**
 * Merge two objects, but throw if both contain the same key.
 *
 * @param {object} one The first object, which is mutated.
 * @param {object} two The second object
 * @return {object} one after it has been mutated to contain everything in two.
 */
function mergeIntoWithNoDuplicateKeys(one, two) {
  invariant(
    one && two && typeof one === 'object' && typeof two === 'object',
    'mergeIntoWithNoDuplicateKeys(): Cannot merge non-objects.'
  );

  for (var key in two) {
    if (two.hasOwnProperty(key)) {
      invariant(
        one[key] === undefined,
        'mergeIntoWithNoDuplicateKeys(): ' +
        'Tried to merge two objects with the same key: `%s`. This conflict ' +
        'may be due to a mixin; in particular, this may be caused by two ' +
        'getInitialState() or getDefaultProps() methods returning objects ' +
        'with clashing keys.',
        key
      );
      one[key] = two[key];
    }
  }
  return one;
}

/**
 * Creates a function that invokes two functions and merges their return values.
 * 创建一个调用两个函数并合并其返回值的函数
 *
 * @param {function} one Function to invoke first.
 * @param {function} two Function to invoke second.
 * @return {function} Function that invokes the two argument functions.
 * @private
 */
function createMergedResultFunction(one, two) {
  return function mergedResult() {
    var a = one.apply(this, arguments);
    var b = two.apply(this, arguments);
    if (a == null) {
      return b;
    } else if (b == null) {
      return a;
    }
    var c = {};
    mergeIntoWithNoDuplicateKeys(c, a);
    mergeIntoWithNoDuplicateKeys(c, b);
    return c;
  };
}

/**
 * Creates a function that invokes two functions and ignores their return vales.
 *
 * @param {function} one Function to invoke first.
 * @param {function} two Function to invoke second.
 * @return {function} Function that invokes the two argument functions.
 * @private
 */
function createChainedFunction(one, two) {
  return function chainedFunction() {
    one.apply(this, arguments);
    two.apply(this, arguments);
  };
}

/**
 * Binds a method to the component.
 *
 * @param {object} component Component whose method is going to be bound.
 * @param {function} method Method to be bound.
 * @return {function} The bound method.
 */
function bindAutoBindMethod(component, method) {
  var boundMethod = method.bind(component);
  if (__DEV__) {
    boundMethod.__reactBoundContext = component;
    boundMethod.__reactBoundMethod = method;
    boundMethod.__reactBoundArguments = null;
    var componentName = component.constructor.displayName;
    var _bind = boundMethod.bind;
    boundMethod.bind = function (newThis, ...args) {
      // User is trying to bind() an autobound method; we effectively will
      // ignore the value of "this" that the user is trying to use, so
      // let's warn.
      if (newThis !== component && newThis !== null) {
        warning(
          false,
          'bind(): React component methods may only be bound to the ' +
          'component instance. See %s',
          componentName
        );
      } else if (!args.length) {
        warning(
          false,
          'bind(): You are binding a component method to the component. ' +
          'React does this for you automatically in a high-performance ' +
          'way, so you can safely remove this call. See %s',
          componentName
        );
        return boundMethod;
      }
      var reboundMethod = _bind.apply(boundMethod, arguments);
      reboundMethod.__reactBoundContext = component;
      reboundMethod.__reactBoundMethod = method;
      reboundMethod.__reactBoundArguments = args;
      return reboundMethod;
    };
  }
  return boundMethod;
}

/**
 * Binds all auto-bound methods in a component.
 *
 * @param {object} component Component whose method is going to be bound.
 */
function bindAutoBindMethods(component) {
  var pairs = component.__reactAutoBindPairs;
  for (var i = 0; i < pairs.length; i += 2) {
    var autoBindKey = pairs[i];
    var method = pairs[i + 1];
    component[autoBindKey] = bindAutoBindMethod(
      component,
      method
    );
  }
}

/**
 * Add more to the ReactClass base class. These are all legacy features and
 * therefore not already part of the modern ReactComponent.
 */
var ReactClassMixin = {

  /**
   * TODO: This will be deprecated because state should always keep a consistent
   * type signature and the only use case for this, is to avoid that.
   */
  replaceState: function (newState, callback) {
    this.updater.enqueueReplaceState(this, newState);
    if (callback) {
      this.updater.enqueueCallback(this, callback, 'replaceState');
    }
  },

  /**
   * Checks whether or not this composite component is mounted.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function () {
    return this.updater.isMounted(this);
  },
};

var ReactClassComponent = function () { }; // 创建一个构造函数

// 会将ReactComponent的原型和ReactClassMixin混进ReactClassComponent的原型对象上。
Object.assign(
  ReactClassComponent.prototype,
  ReactComponent.prototype,  // 该原型上拥有isReactComponent属性
  ReactClassMixin
);




/**
 * Module for creating composite components.
 *
 * @class ReactClass
 */
var ReactClass = {

  /**
   * Creates a composite component class given a class specification.
   *
   * @param {object} spec Class specification (which must define `render`).  配置对象
   * @return {function} Component constructor function.  返回一个构造函数
   * @public
   */
  createClass: function (spec) {

    /**
     * 
     * @param {*} props      属性
     * @param {*} context    上下文
     * @param {*} updater    更新队列
     */
    var Constructor = function (props, context, updater) {
      // This constructor gets overridden by mocks. The argument is used
      // by mocks to assert on what gets mounted.

      // 判断是否是开发环境
      if (__DEV__) {
        warning(
          this instanceof Constructor,
          'Something is calling a React component directly. Use a factory or ' +
          'JSX instead. See: https://fb.me/react-legacyfactory'
        );
      }

      // Wire up auto-binding 自动绑定
      if (this.__reactAutoBindPairs.length) {  // 该数组会存储配置对象上除生命周期外的函数
        bindAutoBindMethods(this);
      }

      this.props = props;  // 属性
      this.context = context;  // 上下文
      this.refs = emptyObject; // refs 对象
      this.updater = updater || ReactNoopUpdateQueue; // 更新队列

      this.state = null;  // 状态

      //  判断是否有默认属性函数，有，将执行，没有则为null
      var initialState = this.getInitialState ? this.getInitialState() : null;

      // 判断是否是开发环境
      if (__DEV__) {

        // 判断getInitialState函数是否返回undefined,如果是后面将会报错警告
        if (initialState === undefined &&
          this.getInitialState._isMockFunction) {

          // This is probably bad practice. Consider warning here and 这可能是不好的做法。考虑此处的警告和
          // deprecating this convenience. 反对这种便利性
          initialState = null;
        }
      };

      invariant(
        typeof initialState === 'object' && !Array.isArray(initialState),
        '%s.getInitialState(): must return an object or null',
        Constructor.displayName || 'ReactCompositeComponent'
      );

      this.state = initialState; // 将默认状态赋到实例属性上
    };

    Constructor.prototype = new ReactClassComponent(); // 该对象原型上将拥有众多属性，其中包括isReactComponent
    Constructor.prototype.constructor = Constructor; // 修正原型中的constructor属性
    Constructor.prototype.__reactAutoBindPairs = []; // 目前为空数组，存储配置对象中除生命周期以外的函数

    // 该injectedMixins数组存储 mixns，并对其进行绑定处理
    injectedMixins.forEach(
      mixSpecIntoComponent.bind(null, Constructor)
    );

    // 对配置对象进行处理，并将里面的属性赋值在函数的原型对象上
    mixSpecIntoComponent(Constructor, spec);

    // 判断是否拥有该属性函数
    if (Constructor.getDefaultProps) {
      Constructor.defaultProps = Constructor.getDefaultProps(); // 生成默认属性
    }

    // 判断是否是开发环境
    if (__DEV__) {
      // This is a tag to indicate that the use of these method names is ok,
      // since it's used with createClass. If it's not, then it's likely a
      // mistake so we'll warn you to use the static property, property
      // initializer or constructor respectively.
      if (Constructor.getDefaultProps) {
        Constructor.getDefaultProps.isReactClassApproved = {};
      }
      if (Constructor.prototype.getInitialState) {
        Constructor.prototype.getInitialState.isReactClassApproved = {};
      }
    }

    invariant(
      Constructor.prototype.render,
      'createClass(...): Class specification must implement a `render` method.'
    );

    if (__DEV__) {
      warning(
        !Constructor.prototype.componentShouldUpdate,
        '%s has a method called ' +
        'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' +
        'The name is phrased as a question because the function is ' +
        'expected to return a value.',
        spec.displayName || 'A component'
      );
      warning(
        !Constructor.prototype.componentWillRecieveProps,
        '%s has a method called ' +
        'componentWillRecieveProps(). Did you mean componentWillReceiveProps()?',
        spec.displayName || 'A component'
      );
    }

    // 通过在原型上设置这些选项，减少查找所花费的时间
    for (var methodName in ReactClassInterface) { // 生命周期以及重要属性
      if (!Constructor.prototype[methodName]) {
        Constructor.prototype[methodName] = null;  // 培没有配置则设置null
      }
    }

    return Constructor; // 将处理后的函数返回出去
  },

  injection: {
    injectMixin: function (mixin) {
      injectedMixins.push(mixin);
    },
  },

};

module.exports = ReactClass;
