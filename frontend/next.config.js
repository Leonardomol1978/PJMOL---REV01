// next.config.js
module.exports = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'export', // necessário para gerar HTML estático com `next export`
};
