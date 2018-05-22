var a = '1';
var b = '2';
var c = '3';
var d = '4';
var e = '5';

define(['./' + a, './' + b, './' + c, './' + d, './' + e], function(a, b, c, d, e) {
  return (a + b + c + d + e);
});
