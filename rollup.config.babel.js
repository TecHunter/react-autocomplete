import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import postcss from 'rollup-plugin-postcss';
import json from 'rollup-plugin-json';
import pkg from './package.json';
import resolve from 'rollup-plugin-node-resolve';

const defaultConf = {
	extensions: ['.js', '.jsx'],
	plugins: [
		postcss({
			modules: true
		}),
		replace({
			'process.env.NODE_ENV': JSON.stringify('development')
		}),
		json(),
		resolve({
			extensions: ['.mjs', '.js', '.jsx', '.json']
		}), // so Rollup can find `ms`
		babel({
			exclude: ['node_modules/**']
		}),

		commonjs({
			include: 'node_modules/**',
			namedExports: {
				'node_modules/react-is/index.js': ['isForwardRef', 'isValidElementType'],
			},
		})
	],
	external: [
		'react',
		'react-dom',
		'prop-types',
	],
};

export default [
	// browser-friendly UMD build
	{
		...defaultConf,
		input: 'src/index.js',
		output: {
			...defaultConf.output,
			name: pkg.name,
			file: 'dist/react-autocomplete.js',
			format: 'umd'
		}
	},
];
