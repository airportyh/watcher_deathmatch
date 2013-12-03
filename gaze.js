var Gaze = require('gaze').Gaze

var g = new Gaze(['src/*.js', '*.js'])

g.on('all', function(evt, filepath){
  console.log(evt, filepath)
})