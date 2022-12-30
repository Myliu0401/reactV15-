/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule dangerousStyleValue
 */

'use strict';

var CSSProperty = require('CSSProperty');
var warning = require('warning');

var isUnitlessNumber = CSSProperty.isUnitlessNumber;
var styleWarnings = {};

/**
 * 将值转换为正确的css可写值。样式名`name`应符合规定的逻辑（无连字符）在`CSSProperty.isUnitlessNumber`中。
 *
 * @param {string} name 属性名
 * @param {*} value 属性值
 * @param {ReactDOMComponent} component   事务
 * @return {string} 应用标注的规格化样式值。
 */
function dangerousStyleValue(name, value, component) {

  // 判断是否有值 或者 值为布尔类型 或者 值为空字符串
  var isEmpty = value == null || typeof value === 'boolean' || value === '';

  // 如果是则返回空字符串
  if (isEmpty) {
    return '';
  };

  var isNonNumeric = isNaN(value); // 判断该值是否为NaN

  // 相当于判断该值是否是数字
  // 判断值是否为NaN 或者 为0 或者 为isUnitlessNumber对象中的值 并且 css属性值必须为数字的属性
  if (isNonNumeric || value === 0 || isUnitlessNumber.hasOwnProperty(name) && isUnitlessNumber[name]) {
    return '' + value;  // 将该值变为字符串返回
  };

  // 判断该值是否为字符串
  if (typeof value === 'string') {
  
    value = value.trim(); // 清除字符串中的头尾空白
  }
  return value + 'px'; // 加上px返回
}

module.exports = dangerousStyleValue;
