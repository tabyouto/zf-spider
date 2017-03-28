var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var sockect = require('./socket/server.js');

var index = require('./routes/index');
var users = require('./routes/users');


var expressSession = require('express-session');
var redis = require('redis');
var RedisStore = require('connect-redis')(expressSession);

var app = express();

var common = require('./common/common');

// 创建Redis客户端
var redisClient = redis.createClient(6379, '127.0.0.1', {auth_pass: ''});
// 设置Express的Session存储中间件
app.use(expressSession({
    store: new RedisStore({client: redisClient}),
    secret: 'mychyunique',
    name: 'zfisbad',
    cookie: {
        domain: '.test1.com',
        maxAge: 1 * 24 * 3600 * 1000
    }, //失效时间 1天
    resave: false,
    saveUninitialized: false
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', index);
app.use('/users', users);

var server = app.listen(9000, function () {
    console.log('server start');
});

sockect(server,redisClient);



// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    console.log(req.body);
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500 || 400);
    console.log('错误信息',err.message);
    switch (err.status) {
        case 1112:
            common.showResult(res, 200, '', {}, '抓取失败', '1112');
            break;
        case 1111:
            common.showResult(res, 200, '', {}, '用户未登录', '1111');
            break;
    }
});




module.exports = app;
