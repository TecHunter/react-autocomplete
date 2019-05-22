import React from 'react'

import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { getStates, SearchAutocomplete } from '../src/utils'
import ReactAutocomplete from '../src/Autocomplete'

storiesOf('ReactAutocomplete', module)
	.add('Simplest', () => (
		<ReactAutocomplete
			items={getStates()}
			onSelect={(value, state) => action('Selected value')(value, JSON.stringify(state))}
			getItemValue={({abbr}) => abbr}
			renderItem={({name}, props) => <div {...props}>{name}</div>}
		/>
	))

	.add('With debounce (autocomplete search)', () => (
			<SearchAutocomplete/>
		)
	)

	.add('Autocomplete search - allow null', () => (
			<SearchAutocomplete allowSelectNothing/>
		)
	)

