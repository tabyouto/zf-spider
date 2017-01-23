/**
 * author: chihaiyue
 * createTime:  2017/1/19.
 */

'use strict';
var iconv = require("iconv-lite");  //编码转换
let info = {
    initUrl: '218.25.35.27:8080',
    middleUrl: '', //类cookie
    postUrl: '',//提交请求的url
    redirectUrl: '', //重定向url 跳转到首页
    name: '',
    onceFlag: false,
    loginInfo: {//登录信息
        '__VIEWSTATE': '',  //隐藏域
        'TextBox1': '',  //学号
        'TextBox2': '',    //密码
        'RadioButtonList1': iconv.encode('学生', 'gbk').toString('binary'),   //登录类型
        'Button1': '',
        'lbLanguage': ''
    },
    scheduleInfo: {
        __EVENTTARGET: 'xnd',
        __EVENTARGUMENT: '',
        __VIEWSTATE: '', //隐藏域
        xnd: '', //学年
        xqd: ''//学期
    },
    allDegreeInfo: {
        '__VIEWSTATE': '',  //隐藏域
        '__EVENTARGUMENT': '',
        'xq': iconv.encode('全部', 'gbk').toString('binary'),
        '__EVENTTARGET': 'xq',
        'kcxz': iconv.encode('全部', 'gbk').toString('binary')
    },
    headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
        'Host': '218.25.35.27:8080',
        'Referer': '218.25.35.27:8080',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36'
    },
    scheduleResult: {},
    degreeName: [],
    degreeId: [],
    courseTempArr: [] //临时保存抓取到的数组
};

module.exports = info;