'use strict'
gulp = require 'gulp'
$ = require('gulp-load-plugins')()
to5 = require 'gulp-6to5'

gulp.task 'js', ->
  gulp.src ['lib/*.coffee']
    .pipe($.coffee {bare: true, nodejs: true, harmony: true}).on 'error', console.log
    .pipe to5()
    .pipe gulp.dest '.'

gulp.task 'clean', require('del').bind null, ['dist']

gulp.task 'concat', ->
  gulp.src ['./rsaFiles/*.js']
    .pipe $.concat 'rsa.js'
    .pipe gulp.dest './rsa.js'

gulp.task 'default', ->
  gulp.start 'js'
