'use strict';

var superagent = require('superagent');  //
var events = require('events');
var emitter = new events.EventEmitter();
let cheerio = require('cheerio');    //转成jquery
var iconv = require("iconv-lite");  //编码转换
var fs = require('fs');
var path = require('path');
var async = require('async'); //处理异步回调
var http = require('http');
var server = http.createServer(); //创建server
var querystring = require("querystring");







var query=require("./mysql.js");  
  
query("select * from class_info",function(err,vals,fields){  
    console.log(vals);
});  






let info = {
    initUrl: '218.25.35.27:8080',
    middleUrl: '', //类cookie
    postUrl: '',//提交请求的url
    redirectUrl: '', //重定向url 跳转到首页 
    name: '',
    loginInfo: {
        '__VIEWSTATE': '',  //隐藏域
        'TextBox1': '',  //学号
        'TextBox2': '',    //密码
        'RadioButtonList1': iconv.encode('学生', 'gbk').toString('binary'),   //登录类型
        'Button1': '',
        'lbLanguage': ''
    },
    headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
        'Host': '218.25.35.27:8080',
        'Referer': '218.25.35.27:8080',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36'
    },
    init: function(callback) {
        var that = this;
        var url = 'http://'+that.initUrl;
        superagent.get(url).end(function(err,res) {
            var tmp = res.redirects[0].match(/\([^\)]+\)/g)[0].substr(1);
            that.middleUrl = tmp.substr(0,tmp.length-1); //截取中间url
            that.postUrl = 'http://'+ that.initUrl +'/(' + that.middleUrl + ')/default2.aspx';
            let $ = cheerio.load(res.text);
            that.loginInfo.__VIEWSTATE = $('[name=__VIEWSTATE]').val() //获取viewState
            that.loginInfo.TextBox1 = '1203050132';
            that.loginInfo.TextBox2 = '123456';
            console.log('----初始化获得middleUrl----');
            callback && callback(null,'');
        })
    },
    binaryParser: function(res, callback) { //转换成buffer
        res.setEncoding('binary');
        res.data = '';
        res.on('data', function (chunk) {
            res.data += chunk;
        });
        res.on('end', function () {
            callback(null, new Buffer(res.data, 'binary'));
        });
    },
    //urlEncode
    urlParse: function(url) {
        return encodeURI(url);
    },
    login: function(callback) {
        var that = this;
        superagent.post(that.postUrl)
        .set(this.headers)
        .send(this.loginInfo)
        .type('form')
        .redirects(0)
        .end(function(err,res) {
            that.redirectUrl = 'http://' + that.initUrl + res.headers.location;  //get 302 url
            console.log('----跳转url----'+ that.redirectUrl);
            callback && callback(null,'');
        })
    },
    getName: function(callback) { //抓取首页获得姓名
        var that = this;
        superagent.get(that.redirectUrl).buffer().parse(that.binaryParser).end(function(err,res) { //获取姓名
            var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
            let $ = cheerio.load(text);
            var name = $('#xhxm').text();
            that.name = name.split(' ')[2].slice(0,-2); //获取姓名
            console.log(that.name);
            callback && callback(null,'');
        })
    },
    //http://218.25.35.27:8080/(0mi22vnwgnoqltmhhu0gn145)/xskbcx.aspx?xh=1203050132&xm=%B3%D8%BA%A3%D4%BE&gnmkdm=N121603
    getSchedule: function() { //获得课程表  默认获取当前课程
        var url = 'http://' + this.initUrl + '/(' + this.middleUrl + ')/xskbcx.aspx?xh=' + this.loginInfo.TextBox1 + '&xm=' + this.name + '&gnmkdm=N121603';
        url = this.urlParse(url);
        var headers = this.headers;
        headers.Referer = this.redirectUrl;
        superagent.get(url).set(headers).buffer().parse(this.binaryParser).end(function(err,res) { //获取姓名
            var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
            let $ = cheerio.load(text,{decodeEntities: false});  //***身默认是转实体的
            var table = $('#Table1').html();
            table = table.replace(/(width|align)=".*?"/g,'');
            fs.writeFile(path.join(__dirname,'test.html'), text,function(err) {
                if(err) throw err;
                console.log('write success ===>');
            })
        })
    },
    switchType: function(type) {
        switch (type) {
            case 'getSchedule': 
                this[type]();
                break;

        }
    }
}


// info.init();

// async.auto({
//     init: function(callback) {
//         info.init(callback); //请求接口
//     },
//     login: ['init',function(results,callback) {
//         info.login(callback);
//     }],
//     getName: ['login',function(results,callback) {
//         info.getName(callback);
//     }],
//     switchType: ['getName',function(results,callback) {
//         info.switchType('getSchedule');
//     }]
// },function(err, results) {
//     console.log('err = ', err);
//     console.log('results = ', results);
// })

//###########################################################
var requestFunction = function (req, res){  
     req.setEncoding('utf-8');
     var postData = '';
      req.addListener("data", function (postDataChunk) {
            postData += postDataChunk;
        });
      req.addListener("end", function () {
            console.log('数据接收完毕');
            var params = querystring.parse(postData);
            console.log(params);
            res.writeHead(200, {
                "Content-Type": "text/html;charset=UTF-8"
            });
            var data = {
                "ret": "1",
                "msg": "success",
                "data": [{"name":"chy","age":"12"},{"name":"chy","age":"12"}]
            };
            res.end(JSON.stringify(data));
        });
}
server.on('request', requestFunction);
server.listen(9000, '127.0.0.1');
console.log('Server running at http://127.0.0.1:9000/');  

//##########################################################################

















// var http = require('http');
// var url = require('url').parse('http://www.baidu.com/');
// var iconv = require('iconv-lite'); 
// var BufferHelper = require('bufferhelper');
 
// http.get(url,function(res){
//   var bufferHelper = new BufferHelper();
//   res.on('data', function (chunk) {
//     console.log(chunk);
//     bufferHelper.concat(chunk);
//   });
//   res.on('end',function(){ 
//     // console.log(iconv.decode(bufferHelper.toBuffer(),'utf8'));
//   });
// })

// let viewState = '';
// let username = '';
// let passwd = '';

// let middleUrl = ''; // 类cookie

// let tempType = '学生';
// let name = '池海跃';
// let type = iconv.encode(tempType, 'gbk').toString('binary');
// let iconName = iconv.encode(name, 'gbk').toString('binary');

// var req = {};

// var reqUrl = 'http://218.25.35.27:8080'; //初始url

// var postUrl = '';  //拼接后的url

// var redirectUrl = '';  //重定向url

// var scheduleUrl = ''; //课程表url  http://218.25.35.27:8080/(xu4nsq55bzlol245r5cj1s55)/xskbcx.aspx?xh=1203050132&xm=%B3%D8%BA%A3%D4%BE&gnmkdm=N121603
                                  // http://218.25.35.27:8080/(n5emotil0jn1u155ayg3yvbc)/xskbcx.aspx?xh=1203050132&xm=³Øº£Ô¾&gnmkdm=N121603

// var scoreUrl = ''; //查询分数页面url
/**
* 拼接url
*/
function joinUrl(type) {
    // switch (type) {
    //     case 'schedule':
    //         scheduleUrl = reqUrl + '/(' + middleUrl + ')/xskbcx.aspx?xh=' + username + '&xm=' + name + '&gnmkdm=N121603';
    //         scheduleUrl = encodeURI(scheduleUrl);
    //         break;
    //     case 'score':
    //         scoreUrl = reqUrl + '/(' + middleUrl + ')/xscjcx.aspx?xh=' + username + '&xm=' + name + '&gnmkdm=N121605'; //http://218.25.35.27:8080/(xu4nsq55bzlol245r5cj1s55)/xscjcx.aspx?xh=1203050132&xm=%B3%D8%BA%A3%D4%BE&gnmkdm=N121605
    //         scoreUrl = encodeURI(scoreUrl);
    //         default:;
    // }
}

//utf8 ==> gbk
//urlEncode
function convertEncode(v,type) {
    // if(type == 'urlEncode') {
    //     return encodeURI(v);
    // }else {
    //     return iconv.encode(v, type).toString('binary');
    // }
}


//跳转到其他功能
// function jumpUrl(type) {
//     switch (type) {
//         case 'schedule':
//             joinUrl(type);
//             if(scheduleUrl) {
//                 console.log(scheduleUrl);
//                 console.log(reqUrl);
//                 superagent
//                     .get(scheduleUrl)
//                         .set({




//                             'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//                             'Accept-Encoding': 'gzip, deflate',
//                             'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
//                             'Host': '218.25.35.27:8080',
//                             'Referer': redirectUrl,
//                             'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36'
//                         })
//                         .end(function(err,pres) {
//                             if(pres.text) {
//                                 var text = iconv.encode(pres.text, 'gbk').toString('binary');
//                                 fs.writeFile(path.join(__dirname, type+'.html'),text,function(err) {
//                                     if(err) throw err;
//                                     console.log('write success ===>'+ __dirname);
//                                 })
//                             }else {
//                                 console.log('*********** text undefined ***********')
//                             }
//                         });
//             }

//             break;
//     }
// }



// setCookie();

// emitter.on('setCookie',getTitles);
// emmiter.on('getPage',getPage);
// function setCookie() {
//     superagent.post('218.25.35.28:8080')
//         .type('form')
//             .send({__VIEWSTATE: ''})
//             .send({TextBox1: ''})
//             .send({TextBox2: ''})
//             .send({RadioButtonList1: ''})
//             .send({Button1: ''})
//             .send({lbLanguage: ''})
// }


// function getPage(url) {
//     superagent.get(url)
//         .end(function(err,pres) { //pres.text 里面存储着请求返回的 html 内容
//             var tmp = pres.redirects[0].match(/\([^\)]+\)/g)[0].substr(1);
//             middleUrl = tmp.substr(0,tmp.length-1); //截取中间url
//             postUrl = 'http://218.25.35.27:8080/('+middleUrl+')/default2.aspx';
//             let $ = cheerio.load(pres.text);
//             viewState = $('[name=__VIEWSTATE]').val() //获取viewState
//             username = '1203050132';
//             passwd = '123456';
//             startLogin();
//             console.log('finish');
//         })
// }

// function startLogin() {
//     req = {
//         '__VIEWSTATE': viewState,
//         'TextBox1': username,
//         'TextBox2': passwd,
//         'RadioButtonList1': type,
//         'Button1': '',
//         'lbLanguage': ''
//     };
//     superagent.post(postUrl)
//         .set({
//             'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//             'Accept-Encoding': 'gzip, deflate',
//             'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
//             'Cache-Control': 'no-cache',
//             'Connection': 'keep-alive',
//             'Content-Type': 'application/x-www-form-urlencoded',
//             'Host': '218.25.35.27:8080',
//             'Origin': 'http://218.25.35.27:8080',
//             'Pragma': 'no-cache',
//             'Referer': postUrl,
//             'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36',
//         })
//         .send(req)
//         .type('form')
//         .redirects(0)
//         .end(function(err,pres) {
//             // console.log(pres);
//             redirectUrl = reqUrl + pres.headers.location;  //get 302 url
//             console.log('跳转url----'+redirectUrl);  
//             superagent.get(redirectUrl).end(function(err,pres) { //获取姓名
//                 let $ = cheerio.load(pres.text);
//                 // fs.writeFile(path.join(__dirname,'index.html'),pres.text,function(err) {
//                 //     if(err) throw err;
//                 //     console.log('write success ===>'+ __dirname);
//                     jumpUrl('schedule');
//                 // })
//             })

            


//         })

        
// }
// getPage(info.initUrl)
