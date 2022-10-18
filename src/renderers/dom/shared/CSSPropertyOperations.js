/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CSSPropertyOperations
 */

'use strict';

var CSSProperty = require('CSSProperty');
var ExecutionEnvironment = require('ExecutionEnvironment');
var ReactPerf = require('ReactPerf');

var camelizeStyleName = require('camelizeStyleName');
var dangerousStyleValue = require('dangerousStyleValue');
var hyphenateStyleName = require('hyphenateStyleName');
var memoizeStringOnly = require('memoizeStringOnly');
var warning = require('warning');

var processStyleName = memoizeStringOnly(function(styleName) {
  return hyphenateStyleName(styleName);
});

var hasShorthandPropertyBug = false;
var styleFloatAccessor = 'cssFloat';
if (ExecutionEnvironment.canUseDOM) {
  var tempStyle = document.createElement('div').style;
  try {
    // IE8 throws "Invalid argument." if resetting shorthand style properties.
    tempStyle.font = '';
  } catch (e) {
    hasShorthandPropertyBug = true;
  }
  // IE8 only supports accessing cssFloat (standard) as styleFloat
  if (document.documentElement.style.cssFloat === undefined) {
    styleFloatAccessor = 'styleFloat';
  }
}

if (__DEV__) {
  // 'msTransform' is correct, but the other prefixes should be capitalized
  var badVendoredStyleNamePattern = /^(?:webkit|moz|o)[A-Z]/;

  // style values shouldn't contain a semicolon
  var badStyleValueWithSemicolonPattern = /;\s*$/;

  var warnedStyleNames = {};
  var warnedStyleValues = {};
  var warnedForNaNValue = false;

  var warnHyphenatedStyleName = function(name, owner) {
    if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
      return;
    }

    warnedStyleNames[name] = true;
    warning(
      false,
      'Unsupported style property %s. Did you mean %s?%s',
      name,
      camelizeStyleName(name),
      checkRenderMessage(owner)
    );
  };

  var warnBadVendoredStyleName = function(name, owner) {
    if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
      return;
    }

    warnedStyleNames[name] = true;
    warning(
      false,
      'Unsupported vendor-prefixed style property %s. Did you mean %s?%s',
      name,
      name.charAt(0).toUpperCase() + name.slice(1),
      checkRenderMessage(owner)
    );
  };

  var warnStyleValueWithSemicolon = function(name, value, owner) {
    if (warnedStyleValues.hasOwnProperty(value) && warnedStyleValues[value]) {
      return;
    }

    warnedStyleValues[value] = true;
    warning(
      false,
      'Style property values shouldn\'t contain a semicolon.%s ' +
      'Try "%s: %s" instead.',
      checkRenderMessage(owner),
      name,
      value.replace(badStyleValueWithSemicolonPattern, '')
    );
  };

  var warnStyleValueIsNaN = function(name, value, owner) {
    if (warnedForNaNValue) {
      return;
    }

    warnedForNaNValue = true;
    warning(
      false,
      '`NaN` is an invalid value for the `%s` css style property.%s',
      name,
      checkRenderMessage(owner)
    );
  };

  var checkRenderMessage = function(owner) {
    if (owner) {
      var name = owner.getName();
      if (name) {
        return ' Check the render method of `' + name + '`.';
      }
    }
    return '';
  };

  /**
   * @param {string} name
   * @param {*} value
   * @param {ReactDOMComponent} component
   */
  var warnValidStyle = function(name, value, component) {
    var owner;
    if (component) {
      owner = component._currentElement._owner;
    }
    if (name.indexOf('-') > -1) {
      warnHyphenatedStyleName(name, owner);
    } else if (badVendoredStyleNamePattern.test(name)) {
      warnBadVendoredStyleName(name, owner);
    } else if (badStyleValueWithSemicolonPattern.test(value)) {
      warnStyleValueWithSemicolon(name, value, owner);
    }

    if (typeof value === 'number' && isNaN(value)) {
      warnStyleValueIsNaN(name, value, owner);
    }
  };
}

/**
 * Operations for dealing with CSS properties.
 */
var CSSPropertyOperations = {

  /**
   * Serializes a mapping of style properties for use as inline styles:
   *
   *   > createMarkupForStyles({width: '200px', height: 0})
   *   "width:200px;height:0;"
   *
   * Undefined values are ignored so that declarative programming is easier.
   * The result should be HTML-escaped before insertion into the DOM.
   *
   * @param {object} styles
   * @param {ReactDOMComponent} component
   * @return {?string}
   */
  createMarkupForStyles: function(styles, component) {
    var serialized = '';
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      var styleValue = styles[styleName];
      if (__DEV__) {
        warnValidStyle(styleName, styleValue, component);
      }
      if (styleValue != null) {
        serialized += processStyleName(styleName) + ':';
        serialized +=
          dangerousStyleValue(styleName, styleValue, component) + ';';
      }
    }
    return serialized || null;
  },

  /**
   * 设置节点上多个样式的值。如果值指定为“”（空字符串），相应的样式属性将被取消设置。
   *
   * @param {DOMElement} node    dom节点
   * @param {object} styles      样式对象
   * @param {ReactDOMComponent} component   组件初始化实例
   */
  setValueForStyles: function(node, styles, component) {

    var style = node.style;  // 获取节点中的样式表

    // 遍历传进来的样式表
    for (var styleName in styles) {
      // 判断该样式表中是否没有该属性
      if (!styles.hasOwnProperty(styleName)) {
        continue;  // 跳过本次循环
      };

      if (__DEV__) {
        warnValidStyle(styleName, styles[styleName], component);
      };

      // 会返回符合css规则的对应属性值
      var styleValue = dangerousStyleValue(
        styleName,  // 样式名
        styles[styleName],  // 样式值
        component  // 事务
      );

      // 判断属性名是否为 float 或者 为cssFloat
      if (styleName === 'float' || styleName === 'cssFloat') {
        styleName = styleFloatAccessor;  // 修改属性名
      };

      
      // 判断处理后的属性值是否有值
      if (styleValue) {
        style[styleName] = styleValue;  // 赋值在节点的样式表中
      } else {
        
        // 判断是否有值并且是shorthandPropertyExpansions对象中的属性
        var expansion = hasShorthandPropertyBug && CSSProperty.shorthandPropertyExpansions[styleName];

        // 判断对应的属性是否有值
        if (expansion) {
          // IE8不喜欢取消设置的速记属性，因此取消设置每个

          // 遍历该属性值
          for (var individualStyleName in expansion) {
            style[individualStyleName] = ''; // 赋值在节点的样式表中
          }
        } else {
          style[styleName] = ''; // 赋值在节点的样式表中
        }
      }
    }
  },

};

ReactPerf.measureMethods(CSSPropertyOperations, 'CSSPropertyOperations', {
  setValueForStyles: 'setValueForStyles',
});

module.exports = CSSPropertyOperations;
