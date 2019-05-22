module.exports = {
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
    '\\.(css|less)$': 'identity-obj-proxy',
    '^babel-runtime(.*)$': '<rootDir>/node_modules/@babel/runtime-corejs2$1'
  },
  setupFilesAfterEnv: ['<rootDir>/jest-plugins.js'],
  transform: {
    '^.+\\-test.jsx?$': 'babel-jest'
  },
  setupFiles: ['jest-plugin-context/setup']
};
