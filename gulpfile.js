var gulp = require('gulp');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var jshint = require('gulp-jshint');

gulp.task('default', ['lint', 'compress']);

gulp.task('lint', function() {
  return gulp.src('./src/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('compress', function() {
  gulp.src('./src/**/*.js')
  	.pipe(concat('NeutriumJS.utilities.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest('./dist'));
});