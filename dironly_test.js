var FW = require('./dironly')

var w = FW('./')

w.on('change', function(filepath){
  console.log('CHANGE', filepath)
})

w.on('add', function(filepath){
  console.log('ADD', filepath)
})

w.on('remove', function(filepath){
  console.log('REMOVE', filepath)
})

setInterval(function(){}, 1000)