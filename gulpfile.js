var gulp        = require("gulp");
var $           = require("gulp-load-plugins")();
var runSequence = require("run-sequence");

var deploy = false;
var sassPaths = [
  "bower_components/normalize.scss/sass",
  "bower_components/foundation-sites/scss",
  "bower_components/motion-ui/src"
];
var jsFiles = [
  "bower_components/jquery/dist/jquery.js",
  "bower_components/scroll-depth/jquery.scrolldepth.js",
  "js/*.js"
];

var seq = function(args, cb) {
  var args = Array.prototype.slice.call(args);
  return function(done){
    return cb(args, done);
  };
};
var watchSeq = function() {
  return seq(arguments, function(args){
    return runSequence.apply(null, args);
  });
};
var pipeForDev = function(pipe){
  return deploy ? $.util.noop() : pipe;
};

/**
 * Precompile scss/sass files into dist/css/app.css.
 */
gulp.task("sass", function() {
  return gulp.src(["scss/app.scss"])
    .pipe($.sass({
      includePaths: sassPaths,
      outputStyle: "compressed"
    })
    .on("error", $.sass.logError))
    .pipe($.autoprefixer({
      browsers: ["last 2 versions", "ie >= 9"]
    }))
    .pipe(gulp.dest("dist/css/"));
});

/**
 * Minify js files and copy them to dist/js folder.
 */
gulp.task("js", function() {
  var task = gulp.src(jsFiles);
  if(deploy){
    task = task.pipe($.minify({ noSource: true, preserveComments: "some" }));
  }
  return task.pipe($.concat("app.js", { newLine: "" }))
    .pipe(gulp.dest("dist/js"));
});

/**
 * Copy the downloaded files.
 */
gulp.task("download", function() {
  return gulp.src("downloads/**/*")
    .pipe(gulp.dest("dist/downloads"));
});

/**
 * Copy the html files to the dist folder.
 */
gulp.task("html", function() {
  var htmlminOpts;
  if(deploy) {
    htmlminOpts = {
      minifyJS: true,
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeRedundantAttributes: true,
      sortAttributes: true,
      sortClassName: true
    };
  }else{
    htmlminOpts = {
      removeComments: true,
      collapseWhitespace: true,
      preserveLineBreaks: true
    };
  }
  var htmlPrettifyOpts = {
    brace_style: "expand",
    indent_char: ' ',
    indent_size: 2
  };
  return gulp.src(["*.html", "!_layout.html"])
    .pipe($.nunjucksRender())
    .pipe(pipeForDev($.frontMatter({ remove: true })))
    .pipe($.htmlmin(htmlminOpts))
    .pipe(pipeForDev($.htmlPrettify(htmlPrettifyOpts)))
    .pipe(gulp.dest("dist/"));
});

/**
 * Copy CNAME to dist.
 */
gulp.task("cname", function(){
  return gulp.src("CNAME").pipe(gulp.dest("dist/"));
});

/**
 * Copy images to dist/images folder.
 */
gulp.task("img", function() {
  return gulp.src("images/**/*")
    .pipe(gulp.dest("dist/images"));
});

/**
 * Builds all assets.
 */
gulp.task("build", ["download", "sass", "js", "cname", "html", "img"]);

/**
 * Clean dist folder.
 */
gulp.task("clean", function(){
  return gulp.src("dist/*", { read: false })
    .pipe($.clean({ force: true }));
});

gulp.task("version", function(){
  var versionConfig = {
    "value": "%MD5%",
    "append": {
      "key": "__v",
      "to": ["css", "js"]
    }
  };

  return gulp.src("dist/**/*.html")
      .pipe($.versionNumber(versionConfig))
      .pipe(gulp.dest("dist"));
});

/**
 * Clean and build the website.
 */
gulp.task("prepare-deploy", function(done) {
  deploy = true;
  runSequence("clean", "build", "version", done);
});

/**
 * Deploys the website.
 */
gulp.task("deploy", ["prepare-deploy"], function(){
  return gulp.src("./dist/**/*")
    .pipe($.ghPages({ branch: "master", message: "Deployed on " + new Date().toString() }));
});

/**
 * Starts a web server within dist folder.
 */
gulp.task("connect", ["build"], function() {
  $.connect.server({
    root: "dist",
    livereload: true,
    middleware: function(connect, opt) {
      return [
        function(req, res, next) {
          if (!req.url.match(/^\/(|.*\..*)$/)) {
            req.url = req.url + ".html";
          }
          var path = "dist" + req.url;
          if(!require("fs").existsSync(path)){
            req.url = "/404.html";
          }
          next();
        }
      ];
    }
  });
});

/**
 * Live reload web pages.
 */
gulp.task("reload", ["html"], function () {
  return gulp.src("*.html")
    .pipe($.connect.reload());
});

/**
 * Watch files and recompile assets when any file is updated.
 */
gulp.task("watch", ["build"], function() {
  gulp.watch(["download/**/*"], watchSeq("download", "reload"));
  gulp.watch(["*.html"], ["reload"]);
  gulp.watch(["scss/**/*.scss"], watchSeq("sass", "reload"));
  gulp.watch(["js/**/*.js"], watchSeq("js","reload"));
  gulp.watch(["images/**/*"], watchSeq("img","reload"));
});

gulp.task("default", ["build", "connect", "watch"]);
