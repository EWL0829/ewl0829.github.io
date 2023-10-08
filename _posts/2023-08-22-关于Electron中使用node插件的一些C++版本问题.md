---
layout: post
title: 2023-08-22-关于Electron中使用node插件的一些问题
subtitle: electron好难用啊~
date: 2023-08-15
author: EWL
header-img: img/home-bg-art.jpg
catalog: true
tags:
  - Electron
  - node
  - node-gyp
---

应该是很久之前就被ABI不一致的问题卡过脖子，导致Electron项目跑不起来，非常头大，最近
又遇到这个问题，但是好在有点时间可以集中解决一下，遂记录一下过程。

最开始出现的现象呢，就是下面这个很经典的NODE_MODULE_VERSION不一致的报错。

```shell
Error: The module '/path/to/native/module.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION $XYZ. This version of Node.js requires
NODE_MODULE_VERSION $ABC. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
```

> 上面的代码来源于electron[文档](https://www.electronjs.org/zh/docs/latest/tutorial/using-native-node-modules)

那么就从这个报错开始，逐步解决，顺便复现一下我当时的debug流程。

### node_module_version

既然报错信息给出了是node_module_version版本不一致，那么先了解下这个node_module_version
的作用。查询了一下electron文档，官方给出的解释是**原生Node.js模块由Electron支持，但由于
Electron具有与给定Node.js不同的应用二进制接口 (ABI)(由于使用Chromium的 BoringSL 而
不是 OpenSSL 等 差异)，您使用的原生模块需要为Electron重新编译**。

这也就是说Electron由于使用了Chromium内核，所以其中由Chromium带来的诸多差异(比如OpenSSL和
BoringSL)，导致了Electron在支持原生Node.js模块的时候，需要使用与给定Node.js不同的ABI，即
我们说的node_module_version。

以我碰到的两个版本号作对比，如下面代码所示：

```shell
Error: The module '/Users/xxx/node_modules/yyy/zzz.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 83. This version of Node.js requires
NODE_MODULE_VERSION 85. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
```

去node官网查询以往版本可知，node_module_version为83的node版本是14.21.3，而85则完全不存在，这就
说明Electron所需的node_module_version并不能简单通过重装node版本来解决。

顺便这里把node官网给出的node_module_version和node版本对应的表格给出来，附原官网[链接](https://nodejs.org/zh-cn/download/releases)。

|     version      |   LTS    |    Date    |     V8      |   npm   | node_module_version |
|:----------------:|:--------:|:----------:|:-----------:|:-------:|:-------------------:|
|  Node.js 20.5.1  |          | 2023-08-09 | 11.3.244.8  |  9.8.0  |         115         |
|  Node.js 19.9.0  |          | 2023-04-10 | 10.8.168.25 |  9.6.3  |         111         |
| Node.js 18.17.1  | Hydrogen | 2023-08-08 | 10.2.154.26 |  9.6.7  |         108         |
|  Node.js 17.9.1  |          | 2022-06-01 | 9.6.180.15  | 8.11.0  |         102         |
| Node.js 16.20.2  | Gallium  | 2023-08-08 | 9.4.146.26  | 8.19.4  |         93          |
| Node.js 15.14.0  |          | 2021-04-06 | 8.6.395.17  |  7.7.6  |         88          |
| Node.js 14.21.3  | Fermium  | 2023-02-16 | 8.4.371.23  | 6.14.18 |         83          |
| Node.js 13.14.0  |          | 2020-04-29 | 7.9.317.25  | 6.14.4  |         79          |
| Node.js 12.22.12 |  Erbium  | 2022-04-05 | 7.8.279.23  | 6.14.16 |         72          |
| Node.js 11.15.0  |          | 2019-04-30 | 7.0.276.38  |  6.7.0  |         67          |
| Node.js 10.24.1  | Dubnium  | 2021-04-06 | 6.8.275.32  | 6.14.12 |         64          |
|  Node.js 9.11.2  |          | 2018-06-12 | 6.2.414.46  |  5.6.0  |         59          |
|  Node.js 8.17.0  |  Carbon  | 2019-12-17 | 6.2.414.78  | 6.13.4  |         57          |
|  Node.js 7.10.1  |          | 2017-07-11 | 5.5.372.43  |  4.2.0  |         51          |
|  Node.js 6.17.1  |  Boron   | 2019-04-03 | 5.1.281.111 | 3.10.10 |         48          |
|  Node.js 5.12.0  |          | 2016-06-23 |  4.6.85.32  |  3.8.6  |         47          |
|  Node.js 4.9.1   |  Argon   | 2018-03-29 | 4.5.103.53  | 2.15.11 |         46          |
| Node.js 0.12.18  |          | 2017-02-22 | 3.28.71.20  | 2.15.11 |         14          |


>**node_module_version**指的是 Node.js 的 ABI (application binary interface) 版本号，用来确定编译 
> Node.js 的 C++ 库版本，以确定是否可以直接加载而不需重新编译。在早期版本中其作为一位十六进制值来储存，而现在
> 表示为一个整数

### Electron-rebuild
在Electron文档中查询node_module_version的时候，其实就已经发现了，这一章不仅在讲abi(后面就全部使用abi代指node_module_version)
而且也在讲如何解决abi版本不一致带来的electron编译失败的问题。

跟着文档中描述的步骤，安装electron-rebuild包，然后在install执行之后，执行rebuild，rebuild的过程
会识别当前的Electron版本，并且为应用自动下载headers以及重新编译原生模块。 当然事情不会这么顺利的解决，
我在rebuild这一步仍然遇到了报错。

```shell
An unhandled error occurred inside electron-rebuild
node-gyp failed to rebuild '/xxx/node_modules/@yyy/zzz'.
Error: `make` failed with exit code: 2

Error: node-gyp failed to rebuild '/xxx/node_modules/@yyy/zzz'.
Error: `make` failed with exit code: 2
    at ModuleRebuilder.rebuildNodeGypModule (/xxx/node_modules/electron-rebuild/lib/src/module-rebuilder.js:193:19)
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
    at async Rebuilder.rebuildModuleAt (/xxx/node_modules/electron-rebuild/lib/src/rebuild.js:190:9)
    at async Rebuilder.rebuild (/xxx/node_modules/electron-rebuild/lib/src/rebuild.js:152:17)
    at async /xxx/node_modules/electron-rebuild/lib/src/cli.js:146:9
```

这个报错看起来似乎在electron-build内部报出的，而且语焉不详，无法查出问题到底是由谁引起的，所以需要在执行指令的时候
加上--verbose参数来打印出更加详细的日志信息。

```shell
./node_modules/.bin/electron-rebuild --verbose
```

执行上述指令后，果然定位到了一个函数名remove_cv_t，报错堆栈信息如下：
```shell
/xxx/.electron-gyp/11.3.0/include/node/v8-internal.h:418:38: error: no template named 'remove_cv_t' in namespace 'std'; did you mean 'remove_cv'?
!std::is_same<Data, std::remove_cv_t<T>>::value>::Perform(data);
                                ~~~~~^~~~~~~~~~~
                                     remove_cv
/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1/type_traits:715:50: note: 'remove_cv' declared here
template <class _Tp> struct _LIBCPP_TEMPLATE_VIS remove_cv
```

这段报错指出了一个信息点: remove_cv和remove_cv_t可能在这个v8-internal.h的头文件中用错了，本来应该使用remove_cv却使用的是
remove_cv_t。那么问题来了，这两者有什么区别呢？经过查询得知，11版本的C++使用的是remove_cv，而remove_cv_t是14版本的C++才开始
使用的，所以在本地的.electron-gyp文件夹下缓存的C++相关的内容版本超前了，而本地需要被rebuild的包(@yyy/zzz)使用的是11版本的C++。

如何断定@yyy/zzz使用的C++版本呢？这就需要去查看zzz包里的binding.gyp文件的配置了，其中有一个targets配置项，如果targets配置项中
的OTHER_CPLUSPLUSFLAGS配置项为-std=c++11，则说明该包所需的版本是11，-std=c++14同理。

去依赖包的binding.gyp查看后，果然使用的是11，如下面代码所示：
```
'xcode_settings': {
    'OTHER_CPLUSPLUSFLAGS': [
        '-std=c++11',
        '-stdlib=libc++',
    ],
}
```

现在手动将本地的.electron-gyp文件夹下的v8-internal.h文件中的remove_cv_t改为remove_cv，然后重新rebuild并再次启动electron
项目，一切都正常了~

### 疑点
本来依赖包在自己的代码中是经过了编译后才会被使用的并且它的binding.gyp文件依赖是C++14，但是很奇怪的点在于，它被npm下载后使用时包内的binding.gyp
文件配置却变成了C++11，这使得本地的.electron-gyp缓存的v8-internal.h头文件中使用的C++14版本的方法无法正常使用。

所以这个问题的根源应该是依赖包自身在被安装前执行的一系列npm hooks出了问题，这导致最终被编译出的node模块无法配置出正确的C++版本。当然，目前
这都还在猜测阶段，后续需要继续验证该依赖包的C++版本到底是在什么时候被修改掉的。


