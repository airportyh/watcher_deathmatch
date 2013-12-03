var FW = require('./new_fireworm')

var w = FW('./')

w.add('src/*.js')
w.add('*.js')

w.on('change', function(filepath){
  console.log(filepath, 'changed')
})

setInterval(function(){}, 1000)