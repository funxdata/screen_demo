### digital screen

#### 相关软件环境

* deno 

js运行环境

```
deno: https://deno.com/
windows： irm https://deno.land/install.ps1 | iex
```

* rust

rust安装运行环境(如果不需要后端代码可以不用安装)

```
网上下载地址:https://www.rust-lang.org/tools/install

```

* screen.exe 安装包

```

下载地址: https://github.com/funxdata/screen/tags

```

#### 运行

* 初始化相关

```
./screen.exe init

```

* 启动开发环境

```
deno task screen "screen.exe所在位置"

例如: deno task screen "./screen.exe"

```

* 打包生成

```
deno task pack

```

* 开机全屏启动


```

$exePath = "C:\Path\To\screen.exe"
$shortcutName = "screen.lnk"
$startupPath = "$([Environment]::GetFolderPath('Startup'))\$shortcutName"
# 创建快捷方式
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($startupPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = Split-Path $exePath
$shortcut.Save()

```

#### 相关内容

* webgl相关

* rust相关