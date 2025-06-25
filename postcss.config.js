// postcss.config.js (Cú pháp đúng cho Tailwind CSS v4)
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {}, // Sửa ở đây: Sử dụng '@tailwindcss/postcss'
    autoprefixer: {},         // Giữ nguyên autoprefixer để tương thích tốt hơn
  },
}