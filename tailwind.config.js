module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        "blood-red": "#660000",
      },
    },
  },
  plugins: [],
  corePlugins: {
    fontFamily: false,
    gridTemplateColumns: false,
  },
};
