/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SimpleEventPlugin
 */

'use strict';

var EventConstants = require('EventConstants');
var EventListener = require('EventListener');
var EventPropagators = require('EventPropagators');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var SyntheticAnimationEvent = require('SyntheticAnimationEvent');
var SyntheticClipboardEvent = require('SyntheticClipboardEvent');
var SyntheticEvent = require('SyntheticEvent');
var SyntheticFocusEvent = require('SyntheticFocusEvent');
var SyntheticKeyboardEvent = require('SyntheticKeyboardEvent');
var SyntheticMouseEvent = require('SyntheticMouseEvent');
var SyntheticDragEvent = require('SyntheticDragEvent');
var SyntheticTouchEvent = require('SyntheticTouchEvent');
var SyntheticTransitionEvent = require('SyntheticTransitionEvent');
var SyntheticUIEvent = require('SyntheticUIEvent');
var SyntheticWheelEvent = require('SyntheticWheelEvent');

var emptyFunction = require('emptyFunction');
var getEventCharCode = require('getEventCharCode');
var invariant = require('invariant');
var keyOf = require('keyOf');

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  abort: {
    phasedRegistrationNames: {
      bubbled: keyOf({onAbort: true}),
      captured: keyOf({onAbortCapture: true}),
    },
  },
  animationEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onAnimationEnd: true}),
      captured: keyOf({onAnimationEndCapture: true}),
    },
  },
  animationIteration: {
    phasedRegistrationNames: {
      bubbled: keyOf({onAnimationIteration: true}),
      captured: keyOf({onAnimationIterationCapture: true}),
    },
  },
  animationStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onAnimationStart: true}),
      captured: keyOf({onAnimationStartCapture: true}),
    },
  },
  blur: {
    phasedRegistrationNames: {
      bubbled: keyOf({onBlur: true}),
      captured: keyOf({onBlurCapture: true}),
    },
  },
  canPlay: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCanPlay: true}),
      captured: keyOf({onCanPlayCapture: true}),
    },
  },
  canPlayThrough: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCanPlayThrough: true}),
      captured: keyOf({onCanPlayThroughCapture: true}),
    },
  },
  click: {
    phasedRegistrationNames: {
      bubbled: keyOf({onClick: true}), // 冒泡的
      captured: keyOf({onClickCapture: true}),  // 捕获的
    },
  },
  contextMenu: {
    phasedRegistrationNames: {
      bubbled: keyOf({onContextMenu: true}),
      captured: keyOf({onContextMenuCapture: true}),
    },
  },
  copy: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCopy: true}),
      captured: keyOf({onCopyCapture: true}),
    },
  },
  cut: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCut: true}),
      captured: keyOf({onCutCapture: true}),
    },
  },
  doubleClick: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDoubleClick: true}),
      captured: keyOf({onDoubleClickCapture: true}),
    },
  },
  drag: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDrag: true}),
      captured: keyOf({onDragCapture: true}),
    },
  },
  dragEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragEnd: true}),
      captured: keyOf({onDragEndCapture: true}),
    },
  },
  dragEnter: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragEnter: true}),
      captured: keyOf({onDragEnterCapture: true}),
    },
  },
  dragExit: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragExit: true}),
      captured: keyOf({onDragExitCapture: true}),
    },
  },
  dragLeave: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragLeave: true}),
      captured: keyOf({onDragLeaveCapture: true}),
    },
  },
  dragOver: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragOver: true}),
      captured: keyOf({onDragOverCapture: true}),
    },
  },
  dragStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragStart: true}),
      captured: keyOf({onDragStartCapture: true}),
    },
  },
  drop: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDrop: true}),
      captured: keyOf({onDropCapture: true}),
    },
  },
  durationChange: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDurationChange: true}),
      captured: keyOf({onDurationChangeCapture: true}),
    },
  },
  emptied: {
    phasedRegistrationNames: {
      bubbled: keyOf({onEmptied: true}),
      captured: keyOf({onEmptiedCapture: true}),
    },
  },
  encrypted: {
    phasedRegistrationNames: {
      bubbled: keyOf({onEncrypted: true}),
      captured: keyOf({onEncryptedCapture: true}),
    },
  },
  ended: {
    phasedRegistrationNames: {
      bubbled: keyOf({onEnded: true}),
      captured: keyOf({onEndedCapture: true}),
    },
  },
  error: {
    phasedRegistrationNames: {
      bubbled: keyOf({onError: true}),
      captured: keyOf({onErrorCapture: true}),
    },
  },
  focus: {
    phasedRegistrationNames: {
      bubbled: keyOf({onFocus: true}),
      captured: keyOf({onFocusCapture: true}),
    },
  },
  input: {
    phasedRegistrationNames: {
      bubbled: keyOf({onInput: true}),
      captured: keyOf({onInputCapture: true}),
    },
  },
  invalid: {
    phasedRegistrationNames: {
      bubbled: keyOf({onInvalid: true}),
      captured: keyOf({onInvalidCapture: true}),
    },
  },
  keyDown: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyDown: true}),
      captured: keyOf({onKeyDownCapture: true}),
    },
  },
  keyPress: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyPress: true}),
      captured: keyOf({onKeyPressCapture: true}),
    },
  },
  keyUp: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyUp: true}),
      captured: keyOf({onKeyUpCapture: true}),
    },
  },
  load: {
    phasedRegistrationNames: {
      bubbled: keyOf({onLoad: true}),
      captured: keyOf({onLoadCapture: true}),
    },
  },
  loadedData: {
    phasedRegistrationNames: {
      bubbled: keyOf({onLoadedData: true}),
      captured: keyOf({onLoadedDataCapture: true}),
    },
  },
  loadedMetadata: {
    phasedRegistrationNames: {
      bubbled: keyOf({onLoadedMetadata: true}),
      captured: keyOf({onLoadedMetadataCapture: true}),
    },
  },
  loadStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onLoadStart: true}),
      captured: keyOf({onLoadStartCapture: true}),
    },
  },
  // Note: We do not allow listening to mouseOver events. Instead, use the
  // onMouseEnter/onMouseLeave created by `EnterLeaveEventPlugin`.
  mouseDown: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseDown: true}),
      captured: keyOf({onMouseDownCapture: true}),
    },
  },
  mouseMove: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseMove: true}),
      captured: keyOf({onMouseMoveCapture: true}),
    },
  },
  mouseOut: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseOut: true}),
      captured: keyOf({onMouseOutCapture: true}),
    },
  },
  mouseOver: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseOver: true}),
      captured: keyOf({onMouseOverCapture: true}),
    },
  },
  mouseUp: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseUp: true}),
      captured: keyOf({onMouseUpCapture: true}),
    },
  },
  paste: {
    phasedRegistrationNames: {
      bubbled: keyOf({onPaste: true}),
      captured: keyOf({onPasteCapture: true}),
    },
  },
  pause: {
    phasedRegistrationNames: {
      bubbled: keyOf({onPause: true}),
      captured: keyOf({onPauseCapture: true}),
    },
  },
  play: {
    phasedRegistrationNames: {
      bubbled: keyOf({onPlay: true}),
      captured: keyOf({onPlayCapture: true}),
    },
  },
  playing: {
    phasedRegistrationNames: {
      bubbled: keyOf({onPlaying: true}),
      captured: keyOf({onPlayingCapture: true}),
    },
  },
  progress: {
    phasedRegistrationNames: {
      bubbled: keyOf({onProgress: true}),
      captured: keyOf({onProgressCapture: true}),
    },
  },
  rateChange: {
    phasedRegistrationNames: {
      bubbled: keyOf({onRateChange: true}),
      captured: keyOf({onRateChangeCapture: true}),
    },
  },
  reset: {
    phasedRegistrationNames: {
      bubbled: keyOf({onReset: true}),
      captured: keyOf({onResetCapture: true}),
    },
  },
  scroll: {
    phasedRegistrationNames: {
      bubbled: keyOf({onScroll: true}),
      captured: keyOf({onScrollCapture: true}),
    },
  },
  seeked: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSeeked: true}),
      captured: keyOf({onSeekedCapture: true}),
    },
  },
  seeking: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSeeking: true}),
      captured: keyOf({onSeekingCapture: true}),
    },
  },
  stalled: {
    phasedRegistrationNames: {
      bubbled: keyOf({onStalled: true}),
      captured: keyOf({onStalledCapture: true}),
    },
  },
  submit: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSubmit: true}),
      captured: keyOf({onSubmitCapture: true}),
    },
  },
  suspend: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSuspend: true}),
      captured: keyOf({onSuspendCapture: true}),
    },
  },
  timeUpdate: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTimeUpdate: true}),
      captured: keyOf({onTimeUpdateCapture: true}),
    },
  },
  touchCancel: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchCancel: true}),
      captured: keyOf({onTouchCancelCapture: true}),
    },
  },
  touchEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchEnd: true}),
      captured: keyOf({onTouchEndCapture: true}),
    },
  },
  touchMove: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchMove: true}),
      captured: keyOf({onTouchMoveCapture: true}),
    },
  },
  touchStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchStart: true}),
      captured: keyOf({onTouchStartCapture: true}),
    },
  },
  transitionEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTransitionEnd: true}),
      captured: keyOf({onTransitionEndCapture: true}),
    },
  },
  volumeChange: {
    phasedRegistrationNames: {
      bubbled: keyOf({onVolumeChange: true}),
      captured: keyOf({onVolumeChangeCapture: true}),
    },
  },
  waiting: {
    phasedRegistrationNames: {
      bubbled: keyOf({onWaiting: true}),
      captured: keyOf({onWaitingCapture: true}),
    },
  },
  wheel: {
    phasedRegistrationNames: {
      bubbled: keyOf({onWheel: true}),
      captured: keyOf({onWheelCapture: true}),
    },
  },
};

var topLevelEventsToDispatchConfig = {
  topAbort:           eventTypes.abort,
  topAnimationEnd:    eventTypes.animationEnd,
  topAnimationIteration: eventTypes.animationIteration,
  topAnimationStart:  eventTypes.animationStart,
  topBlur:            eventTypes.blur,
  topCanPlay:         eventTypes.canPlay,
  topCanPlayThrough:  eventTypes.canPlayThrough,
  topClick:           eventTypes.click,
  topContextMenu:     eventTypes.contextMenu,
  topCopy:            eventTypes.copy,
  topCut:             eventTypes.cut,
  topDoubleClick:     eventTypes.doubleClick,
  topDrag:            eventTypes.drag,
  topDragEnd:         eventTypes.dragEnd,
  topDragEnter:       eventTypes.dragEnter,
  topDragExit:        eventTypes.dragExit,
  topDragLeave:       eventTypes.dragLeave,
  topDragOver:        eventTypes.dragOver,
  topDragStart:       eventTypes.dragStart,
  topDrop:            eventTypes.drop,
  topDurationChange:  eventTypes.durationChange,
  topEmptied:         eventTypes.emptied,
  topEncrypted:       eventTypes.encrypted,
  topEnded:           eventTypes.ended,
  topError:           eventTypes.error,
  topFocus:           eventTypes.focus,
  topInput:           eventTypes.input,
  topInvalid:         eventTypes.invalid,
  topKeyDown:         eventTypes.keyDown,
  topKeyPress:        eventTypes.keyPress,
  topKeyUp:           eventTypes.keyUp,
  topLoad:            eventTypes.load,
  topLoadedData:      eventTypes.loadedData,
  topLoadedMetadata:  eventTypes.loadedMetadata,
  topLoadStart:       eventTypes.loadStart,
  topMouseDown:       eventTypes.mouseDown,
  topMouseMove:       eventTypes.mouseMove,
  topMouseOut:        eventTypes.mouseOut,
  topMouseOver:       eventTypes.mouseOver,
  topMouseUp:         eventTypes.mouseUp,
  topPaste:           eventTypes.paste,
  topPause:           eventTypes.pause,
  topPlay:            eventTypes.play,
  topPlaying:         eventTypes.playing,
  topProgress:        eventTypes.progress,
  topRateChange:      eventTypes.rateChange,
  topReset:           eventTypes.reset,
  topScroll:          eventTypes.scroll,
  topSeeked:          eventTypes.seeked,
  topSeeking:         eventTypes.seeking,
  topStalled:         eventTypes.stalled,
  topSubmit:          eventTypes.submit,
  topSuspend:         eventTypes.suspend,
  topTimeUpdate:      eventTypes.timeUpdate,
  topTouchCancel:     eventTypes.touchCancel,
  topTouchEnd:        eventTypes.touchEnd,
  topTouchMove:       eventTypes.touchMove,
  topTouchStart:      eventTypes.touchStart,
  topTransitionEnd:   eventTypes.transitionEnd,
  topVolumeChange:    eventTypes.volumeChange,
  topWaiting:         eventTypes.waiting,
  topWheel:           eventTypes.wheel,
};



for (var type in topLevelEventsToDispatchConfig) {
  /* 对eventTypes中的属性进行增强，增强后将拥有dependencies属性，
  属性值为数组，数组中为topLevelEventsToDispatchConfig中对应的属性名 */
  topLevelEventsToDispatchConfig[type].dependencies = [type]; 
}

var ON_CLICK_KEY = keyOf({onClick: null});
var onClickListeners = {};  // 存储点击事件的删除事件函数

var SimpleEventPlugin = {

  eventTypes: eventTypes,

  /**
   * 生成合成事件对象 
   * @param {*} topLevelType       映射的事件名  如： topClick
   * @param {*} targetInst         组件初始化实例
   * @param {*} nativeEvent        事件对象
   * @param {*} nativeEventTarget  触发事件目标节点的dom
   * @returns  
   */
  extractEvents: function(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget
  ) {
    var dispatchConfig = topLevelEventsToDispatchConfig[topLevelType]; // 获取对应的事件类型块

    // 没有值则直接结束
    if (!dispatchConfig) {
      return null;
    };

    var EventConstructor;


    /* 
    
    switch 语句中的分支匹配是只进行一次的，也就是它找到第一个匹配的 case 后就停止检查其他分支。如果没有break
    它会继续顺序执行后面的代码，不会再检查条件是否匹配。这就是 fall-through 的行为，
    跟 if-else 的逐条件匹配机制不同。
    
    */

    // 判断事件类型，该topLevelTypes对象为EventConstants模块中的topLevelTypes对象
    switch (topLevelType) {
      case topLevelTypes.topAbort:
      case topLevelTypes.topCanPlay:
      case topLevelTypes.topCanPlayThrough:
      case topLevelTypes.topDurationChange:
      case topLevelTypes.topEmptied:
      case topLevelTypes.topEncrypted:
      case topLevelTypes.topEnded:
      case topLevelTypes.topError:
      case topLevelTypes.topInput:
      case topLevelTypes.topInvalid:
      case topLevelTypes.topLoad:
      case topLevelTypes.topLoadedData:
      case topLevelTypes.topLoadedMetadata:
      case topLevelTypes.topLoadStart:
      case topLevelTypes.topPause:
      case topLevelTypes.topPlay:
      case topLevelTypes.topPlaying:
      case topLevelTypes.topProgress:
      case topLevelTypes.topRateChange:
      case topLevelTypes.topReset:
      case topLevelTypes.topSeeked:
      case topLevelTypes.topSeeking:
      case topLevelTypes.topStalled:
      case topLevelTypes.topSubmit:
      case topLevelTypes.topSuspend:
      case topLevelTypes.topTimeUpdate:
      case topLevelTypes.topVolumeChange:
      case topLevelTypes.topWaiting:
        // HTML Events
        // @see http://www.w3.org/TR/html5/index.html#events-0
        EventConstructor = SyntheticEvent;
        break;
      case topLevelTypes.topKeyPress:
        // Firefox creates a keypress event for function keys too. This removes
        // the unwanted keypress events. Enter is however both printable and
        // non-printable. One would expect Tab to be as well (but it isn't).
        if (getEventCharCode(nativeEvent) === 0) {
          return null;
        }
        /* falls through */
      case topLevelTypes.topKeyDown:
      case topLevelTypes.topKeyUp:
        EventConstructor = SyntheticKeyboardEvent;
        break;
      case topLevelTypes.topBlur:
      case topLevelTypes.topFocus:
        EventConstructor = SyntheticFocusEvent;
        break;
      case topLevelTypes.topClick:
        // 如果等于 2，表示是鼠标右键点击事件，直接忽略。
        if (nativeEvent.button === 2) {
          return null;
        }
        /* 通过 */
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topDoubleClick:
      case topLevelTypes.topMouseDown:
      case topLevelTypes.topMouseMove:
      case topLevelTypes.topMouseOut:
      case topLevelTypes.topMouseOver:
      case topLevelTypes.topMouseUp:
        EventConstructor = SyntheticMouseEvent;
        break;
      case topLevelTypes.topDrag:
      case topLevelTypes.topDragEnd:
      case topLevelTypes.topDragEnter:
      case topLevelTypes.topDragExit:
      case topLevelTypes.topDragLeave:
      case topLevelTypes.topDragOver:
      case topLevelTypes.topDragStart:
      case topLevelTypes.topDrop:
        EventConstructor = SyntheticDragEvent;
        break;
      case topLevelTypes.topTouchCancel:
      case topLevelTypes.topTouchEnd:
      case topLevelTypes.topTouchMove:
      case topLevelTypes.topTouchStart:
        EventConstructor = SyntheticTouchEvent;
        break;
      case topLevelTypes.topAnimationEnd:
      case topLevelTypes.topAnimationIteration:
      case topLevelTypes.topAnimationStart:
        EventConstructor = SyntheticAnimationEvent;
        break;
      case topLevelTypes.topTransitionEnd:
        EventConstructor = SyntheticTransitionEvent;
        break;
      case topLevelTypes.topScroll:
        EventConstructor = SyntheticUIEvent;
        break;
      case topLevelTypes.topWheel:
        EventConstructor = SyntheticWheelEvent;
        break;
      case topLevelTypes.topCopy:
      case topLevelTypes.topCut:
      case topLevelTypes.topPaste:
        EventConstructor = SyntheticClipboardEvent;
        break;
    };

  

    // 生成对应类型事件的合成事件对象
    var event = EventConstructor.getPooled(
      dispatchConfig, // 对应的事件类型块
      targetInst, // 组件初始化实例
      nativeEvent, // 原生事件对象
      nativeEventTarget // 触发事件目标节点的dom
    );

    // 会将处理函数存到合成事件对象中，并将实例存到合成事件对象中
    EventPropagators.accumulateTwoPhaseDispatches(event); 

    return event;
  },


  /**
   * 
   * @param {*} inst 组件初始化实例
   * @param {*} registrationName 事件名如 onClick
   * @param {*} listener 事件处理函数
   */
  didPutListener: function(inst, registrationName, listener) {


    // 判断是否是点击事件 onClick
    if (registrationName === ON_CLICK_KEY) {
      var id = inst._rootNodeID;
      var node = ReactDOMComponentTree.getNodeFromInstance(inst);
      if (!onClickListeners[id]) {
        onClickListeners[id] = EventListener.listen(
          node,
          'click',
          emptyFunction
        );
      }
    }
  },



  /**
   * 删除事件
   * @param {*} inst 组件初始化的实例对象
   * @param {*} registrationName  事件名称
   */
  willDeleteListener: function(inst, registrationName) {

    // 判断该事件是否是 onClick 事件
    if (registrationName === ON_CLICK_KEY) {
      var id = inst._rootNodeID;
      onClickListeners[id].remove();   // 删除点击事件的处理函数
      delete onClickListeners[id];     // 删除点击事件的处理函数
    }
  },

};

module.exports = SimpleEventPlugin;
