/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultInjection
 */

'use strict';

var BeforeInputEventPlugin = require('BeforeInputEventPlugin');
var ChangeEventPlugin = require('ChangeEventPlugin');
var DefaultEventPluginOrder = require('DefaultEventPluginOrder');
var EnterLeaveEventPlugin = require('EnterLeaveEventPlugin');
var ExecutionEnvironment = require('ExecutionEnvironment');
var HTMLDOMPropertyConfig = require('HTMLDOMPropertyConfig');
var ReactComponentBrowserEnvironment =
  require('ReactComponentBrowserEnvironment');
var ReactDOMComponent = require('ReactDOMComponent');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var ReactDOMEmptyComponent = require('ReactDOMEmptyComponent');
var ReactDOMTreeTraversal = require('ReactDOMTreeTraversal');
var ReactDOMTextComponent = require('ReactDOMTextComponent');
var ReactDefaultBatchingStrategy = require('ReactDefaultBatchingStrategy');
var ReactEventListener = require('ReactEventListener');
var ReactInjection = require('ReactInjection');
var ReactReconcileTransaction = require('ReactReconcileTransaction');
var SVGDOMPropertyConfig = require('SVGDOMPropertyConfig');
var SelectEventPlugin = require('SelectEventPlugin');
var SimpleEventPlugin = require('SimpleEventPlugin');

var alreadyInjected = false;

function inject() {
  if (alreadyInjected) {
    // TODO: This is currently true because these injections are shared between
    // the client and the server package. They should be built independently
    // and not share any injection state. Then this problem will be solved.
    return;
  }
  alreadyInjected = true;


  /* 
        EventEmitter为ReactBrowserEventEmitter模块的injection对象
        向ReactEventListener模块中的_handleTopLevel属性赋值为ReactEventEmitterMixin模块中的handleTopLevel函数
        并且向ReactBrowserEventEmitter模块中的ReactEventListener属性赋值为ReactEventListener模块
  */
  ReactInjection.EventEmitter.injectReactEventListener(
    ReactEventListener
  );


  /**
   * 注入模块以解析DOM层次结构和插件顺序。
   * 
   * injectEventPluginOrder函数执行后EventPluginRegistry模块中的EventPluginOrder属性变成了数组
   * ['ResponderEventPlugin', 'SimpleEventPlugin', 'TapEventPlugin', 'EnterLeaveEventPlugin', 'ChangeEventPlugin', 'SelectEventPlugin', 'BeforeInputEventPlugin']
   * 
   * injectComponentTree函数执行后EventPluginUtils模块中的ComponentTree属性变成了ReactDOMComponentTree模块
   * 
   * injectTreeTraversal函数执行后EventPluginUtils模块中的TreeTraversal属性变成了ReactDOMTreeTraversal模块
   */
  ReactInjection.EventPluginHub.injectEventPluginOrder(DefaultEventPluginOrder);
  ReactInjection.EventPluginUtils.injectComponentTree(ReactDOMComponentTree);
  ReactInjection.EventPluginUtils.injectTreeTraversal(ReactDOMTreeTraversal);



  /**
   * injectEventPluginsByName函数EventPluginRegistry模块的injectEventPluginsByName函数
   * 默认包含一些重要的事件插件（无需要求它们）。
   * 该函数执行后
   * 
   * EventPluginRegistry模块中的namesToPlugins属性变成了以下对象
   * {
      SimpleEventPlugin: SimpleEventPlugin,
      EnterLeaveEventPlugin: EnterLeaveEventPlugin,
      ChangeEventPlugin: ChangeEventPlugin,
      SelectEventPlugin: SelectEventPlugin,
      BeforeInputEventPlugin: BeforeInputEventPlugin,
     }
   *
   * EventPluginRegistry模块中的plugins属性变成了以下数组
   * [SimpleEventPlugin,EnterLeaveEventPlugin,ChangeEventPlugin,SelectEventPlugin,BeforeInputEventPlugin]
   * 
   * EventPluginRegistry模块中的eventNameDispatchConfigs属性变成了以下对象
   * {
   *    click: {
          phasedRegistrationNames: {
           bubbled: keyOf({onClick: true}),
           captured: keyOf({onClickCapture: true}),
           },
           dependencies: ['topClick']   
        },

        ...等等其他事件
   * }

   *  EventPluginRegistry模块中的registrationNameModules属性变成以下对象
      {
        onClick: 事件模块
        ...
      }

      EventPluginRegistry模块中的registrationNameDependencies属性变成以下对象
      {
        onClick: ['topClick']
        onClickCapture: ['topClick']
      }
   */
  ReactInjection.EventPluginHub.injectEventPluginsByName({
    SimpleEventPlugin: SimpleEventPlugin,    // 简单事件插件
    EnterLeaveEventPlugin: EnterLeaveEventPlugin, // 进入离开事件插件
    ChangeEventPlugin: ChangeEventPlugin,  // 更改事件插件
    SelectEventPlugin: SelectEventPlugin,  // 选择事件插件 
    BeforeInputEventPlugin: BeforeInputEventPlugin, // 输入事件插件之前
  });


  ReactInjection.NativeComponent.injectGenericComponentClass(
    ReactDOMComponent
  );

  ReactInjection.NativeComponent.injectTextComponentClass(
    ReactDOMTextComponent
  );

  ReactInjection.DOMProperty.injectDOMPropertyConfig(HTMLDOMPropertyConfig);
  ReactInjection.DOMProperty.injectDOMPropertyConfig(SVGDOMPropertyConfig);

  ReactInjection.EmptyComponent.injectEmptyComponentFactory(
    function(instantiate) {
      return new ReactDOMEmptyComponent(instantiate);
    }
  );

  ReactInjection.Updates.injectReconcileTransaction(
    ReactReconcileTransaction
  );
  ReactInjection.Updates.injectBatchingStrategy(
    ReactDefaultBatchingStrategy
  );

  ReactInjection.Component.injectEnvironment(ReactComponentBrowserEnvironment);

  if (__DEV__) {
    var url = (ExecutionEnvironment.canUseDOM && window.location.href) || '';
    if ((/[?&]react_perf\b/).test(url)) {
      var ReactDefaultPerf = require('ReactDefaultPerf');
      ReactDefaultPerf.start();
    }
  }
}

module.exports = {
  inject: inject,
};
