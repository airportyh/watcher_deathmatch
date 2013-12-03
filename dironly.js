var fs = require('fs')
var path = require('path')
var async = require('async')
var assert = require('assert')

var EventEmitter = require('events').EventEmitter

function DirOnlyWatcher(dir){
  if (!(this instanceof DirOnlyWatcher)){
    return new DirOnlyWatcher(dir)
  }
  this.dirWatchers = {}
  this.fileStats = {}
  this.crawl(dir)
}

DirOnlyWatcher.prototype = {
  __proto__: EventEmitter.prototype,
  crawl: function(dir){
    var dirWatchers = this.dirWatchers
    var fileStats = this.fileStats
    var onDirAccessed = this._onDirAccessed.bind(this)
    walk(dir, {
      visitFile: function(filepath, stat){
        fileStats[filepath] = stat
      },
      visitDir: function(dirpath, stat){
        dirWatchers[dirpath] = fs.watch(dirpath, function(evt, filename){
          onDirAccessed(evt, filename, dirpath)
        })
      }, 
    }, function(){
      console.log(Object.keys(dirWatchers).length, 'dirs watched.')
    })
  },
  _cleanUpDir: function(dirpath){
    var watcher = this.dirWatchers[dirpath]
    if (watcher) watcher.close()
    // TODO: also clean up subdirectory watchers
  },
  _onDirAccessed: function(evt, filename, dirpath){
    var self = this
    console.log(evt, path.join(dirpath, filename))
    fs.readdir(dirpath, function(err, files){
      if (err){
        if (err.code === 'ENOENT'){
          // just skip if the directory went away
          self._cleanUpDir(dirpath)
        }else{
          self.emit('error', err)
        }
        return
      }
      //console.log(dirpath, 'files', files)
      async.each(files, function(file, next){
        var filepath = path.join(dirpath, file)
        var prevStat = self.fileStats[filepath]

        fs.stat(filepath, function(err, stat){
          console.log('stat', filepath, err)
          self.fileStats[filepath] = stat
          if (err){
            if (err.code === 'ENOENT'){
              if (prevStat){
                if (prevStat.isDirectory()){
                  // directory was removed
                  // clean up directory watcher
                  self._cleanUpDir(dirpath)
                }else{
                  // file was removed
                  self.emit('remove', filepath)
                }
              }else{
                // nothing to do
              }
            }else{
              self.emit('error', err)
            }
            return next(null)
          }
          if (stat.isDirectory()){
            if (prevStat){
              // skip. Not traversing through existing directories
              next(null)
            }else{
              // a new directory, traverse it
              self.crawl(filepath)
            }
          }else{
            // is a file
            if (prevStat){
              if (stat.mtime.getTime() > prevStat.mtime.getTime()){
                self.emit('change', filepath)
              }else{
                // nothing to do
              }
            }else{
              // did not exist before
              self.emit('add', filepath)
            }
            next(null)
          }
        })
      }, function(){

      })
    })
  } 
}

module.exports = DirOnlyWatcher

function walk(somepath, options, doneWalk){
  fs.stat(somepath, function(err, stat){
    if (stat.isDirectory()){
      options.visitDir(somepath, stat)
      fs.readdir(somepath, function(err, files){
        async.each(files, function(file, next){
          var filepath = path.join(somepath, file)
          walk(filepath, options, next)
        }, doneWalk)
      })
    }else{
      options.visitFile(somepath, stat)
      doneWalk(null)
    }
  })
}