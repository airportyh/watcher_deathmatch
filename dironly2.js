var fs = require('fs')
var path = require('path')
var async = require('async')
var assert = require('assert')
var EventEmitter = require('events').EventEmitter

function DirOnlyWatcher(dirpath){
  if (!(this instanceof DirOnlyWatcher)){
    return new DirOnlyWatcher(dirpath)
  }
  var self = this
  this.dir = new Dir(dirpath, self)
  this.dir.update()
}

DirOnlyWatcher.prototype = {
  __proto__: EventEmitter.prototype
}

module.exports = DirOnlyWatcher

function Dir(dirpath, sink){
  // var stat = fs.statSync(dirpath)
  // assert(stat.isDirectory(), 'A Dir must be a directory.')
  this.path = dirpath
  this.entries = {}
  this.watcher = null
  this.sink = sink
}

Dir.prototype = {
  update: function(){
    var self = this
    this.watcher = this.watcher || 
      fs.watch(this.path, this.update.bind(this))
    for (var entryName in this.entries){
      var entry = this.entries[entryName]
      if (entry.isDirectory()){
        // do nothing for existing directories
      }else{
        entry.update()
      }
    }
    fs.readdir(this.path, function(err, entryNames){
      if (err){
        if (err.code === 'ENOENT'){
          // ignore, this means the directory has been
          // removed, but the parent node should
          // handle the destroy
        }else{
          self.sink.emit('error', err)
        }
        return
      }

      // detect added entries
      var newEntries = entryNames.filter(function(entryName){
        return !self.entries[entryName]
      })

      async.each(newEntries, function(entryName, next){
        var entryPath = path.join(self.path, entryName)
        fs.stat(entryPath, function(err, stat){
          if (err){
            if (err.code === 'ENOENT'){
              // ignore - it was a fleeting file?
            }else{
              self.sink.emit('error', err)
            }
            return
          }
          self.sink.emit('add', entryPath)
          if (stat.isDirectory()){
            var dir = self.entries[entryName] = new Dir(entryPath, self.sink)
            dir.update()
          }else{
            self.entries[entryName] = new File(entryPath, stat, self.sink)
          }
        })
      })

      // detect removed entries
      for (var entryName in self.entries){
        if (entryNames.indexOf(entryName) === -1){
          // entry was removed
          var entry = self.entries[entryName]
          entry.destroy()
          delete self.entries[entryName]
        }
      }

    })
  },
  isDirectory: function(){
    return true
  },
  destroy: function(){
    assert(this.watcher != null, 'A directory should always be watched.')
    this.watcher.close()
    for (var entryName in this.entries){
      var entry = this.entries[entryName]
      entry.destroy()
    }
    this.sink.emit('remove', this.path)
  }
}

function File(filepath, stat, sink){
  this.path = filepath
  this.stat = stat
  this.sink = sink
}

File.prototype = {
  update: function(){
    var self = this
    var prevStat = this.stat
    fs.stat(this.path, function(err, stat){
      self.stat = stat
      if (err){
        if (err.code === 'ENOENT'){
          // file no longer exists
          // but ignore because parent node will
          // take care of clean up
        }else{
          self.sink.emit('error', err)
        }
        return
      }
      assert(prevStat != null, 'File should always be initialied with stat')
      if (stat.mtime.getTime() > prevStat.mtime.getTime()){
        self.sink.emit('change', self.path)
      }else{
        // remained the same
      }
    })
  },
  isDirectory: function(){
    return false
  },
  destroy: function(){
    this.sink.emit('remove', this.path)
  }
}
