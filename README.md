# RepairSystem Frontend · 门店设施报修前端

供总部管理员、门店管理员和工程师使用的独立前端：报修、审核、采购订单与 OCR 辅助填充、工程师派单与维修、门店验收、系统内通知和总部统计。

React 18 / TypeScript / Vite 5 / Ant Design 5 / Ant Design Icons。后端在独立 RepairSystem-backend 仓库，JDK 21，通过 HTTP API 交互；构建前端无需后端源码。

## 开发和构建

在本仓库根目录执行：

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

默认访问 http://127.0.0.1:5173，/api 代理到 http://127.0.0.1:8080。可复制 .env.example 为 .env.local，更改 VITE_DEV_PROXY_TARGET 指向实际后端。

```powershell
npm run lint
npm run build
npm run preview
```

产物 dist/ 可独立部署到静态服务器。使用 history 路由，服务器需让页面路径回退到 index.html。默认 API 前缀为 /api/v1，生产服务器需将 /api 反向代理至 Java 后端；也可在构建前设置 VITE_API_BASE_URL=https://后端域名/api/v1，并在后端 REPAIR_CORS_ORIGINS 中允许前端域名。VITE_* 是公开构建配置，不要放入密码或密钥。修改构建变量后需重新构建。

Windows 本机后台预览可执行 `powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1`；日志和进程记录只放在被忽略的 .local/，不启动后端。

## 上传和联调

本目录拥有独立 Git 仓库，可单独关联前端远程仓库并上传。提交 package-lock.json，忽略 node_modules/、dist/、.local/ 和私有 .env 文件。

API 快照在 [docs/openapi.json](docs/openapi.json)，UI 规范在 [docs/ui-design.md](docs/ui-design.md)。完整浏览器联调脚本由后端维护，可将本项目构建后的 dist 目录通过 REPAIR_FRONTEND_DIST 提供给后端测试。
