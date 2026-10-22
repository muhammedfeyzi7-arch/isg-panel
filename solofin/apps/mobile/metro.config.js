// Metro yapılandırması: @solofin/core, symlink ile bağlanan yerel kaynak paketidir.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const coreRoot = path.resolve(projectRoot, "../../packages/core");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), coreRoot];
// core'un bağımlılıkları (zod) bu uygulamanın node_modules'ından çözülür; tek kopya kullanılır.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.extraNodeModules = { zod: path.resolve(projectRoot, "node_modules/zod") };
// core'un kendi test bağımlılıkları paketlenmesin
config.resolver.blockList = [new RegExp(`${coreRoot.replace(/[/\\]/g, "[/\\\\]")}[/\\\\]node_modules[/\\\\].*`)];

module.exports = config;
