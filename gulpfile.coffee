'use strict'
gulp = require 'gulp'
$ = require('gulp-load-plugins')()

gulp.task 'js', ->
  gulp.src ['lib/*.coffee']
    .pipe($.coffee {bare: true, nodejs: true, harmony: true}).on 'error', console.log
    .pipe gulp.dest 'dist/js'

gulp.task 'clean', require('del').bind null, ['dist']

gulp.task 'concat', ->
  gulp.src ['./rsaFiles/*.js']
    .pipe $.concat 'rsa.js'
    .pipe gulp.dest './rsa.js'

gulp.task 'default', ->
  gulp.start 'js'
