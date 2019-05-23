import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import scrollIntoView from 'dom-scroll-into-view';
import classnames from 'classnames';

function useTimeout(fn, timer, inputs) {
	useEffect(() => {
		const handler = setTimeout(fn, timer)
		return () => clearTimeout(handler)
	}, inputs)
}

function useDebounceValue(value, delay = 500, cb) {
	const [val, setValue] = useState(value)
	// State and setters for debounced value
	const [debouncedValue, setDebouncedValue] = useState(val)

	useTimeout(() => setDebouncedValue(val), delay, [val])
	useEffect(() => {
		if (cb) {
			cb(debouncedValue)
		}
	}, [debouncedValue])
	return [val, debouncedValue, setValue]
}

function getScrollOffset() {
	return {
		x: (window.pageXOffset !== undefined)
			? window.pageXOffset
			: (document.documentElement || document.body.parentNode || document.body).scrollLeft,
		y: (window.pageYOffset !== undefined)
			? window.pageYOffset
			: (document.documentElement || document.body.parentNode || document.body).scrollTop,
	}
}

const Item = ({ item, active, renderItem, refMenu, style, ...props }) => {
	const ref = useRef(null)
	useEffect(() => {
		if (active) {
			scrollIntoView(
				ref.current,
				refMenu.current,
				{ onlyScrollIfNeeded: true }
			)
		}
	}, [active])

	return renderItem(item, { active: active || undefined, ref, className: classnames('item', active && 'active'), ...props })
}

const Autocomplete = ({
												debounce,
												// loading,
												menuStyle,
												allowSelectNothing,
												items,
												value,
												onChange,
												onSelect,
												shouldItemRender,
												isItemSelectable,
												sortItems,
												getItemValue,
												renderItem,
												renderMenu,
												renderInput,
												inputProps,
												wrapperProps,
												wrapperStyle,
												autoHighlight,

												selectOnBlur,
												onMenuVisibilityChange,
												open: userOpen,
												debug
											}) => {
	const [isOpen, setOpen] = useState(userOpen)
	const [_ignoreBlur, setIgnoreBlur] = useState(false)
	const [_scrollOffset, setScrollOffset] = useState(false)
	const [_ignoreFocus, setIgnoreFocus] = useState(true)
	const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, minWidth: 0 })
	const [highlightedIndex, setHighlightedIndex] = useState(null)
	const [filteredItems, setFilteredItems] = useState([])
	const [val, debouncedValue, setValue] = useDebounceValue(
		value,
		debounce === true ? 500 : debounce || 0,
		(newVal) => {
			if (newVal) {
				onChange(newVal)
			}
		}
	)
	const refInput = useRef(null)
	const refMenu = useRef(null)

	useEffect(() => setOpen(userOpen), [userOpen])
	useEffect(() => {
		setIgnoreFocus(false)
		if (!items) {
			setFilteredItems([])
		} else {
			let result = items
			if (shouldItemRender) {
				result = result.filter((item) => (
					shouldItemRender(item, value)
				))
			}

			if (sortItems) {
				result.sort((a, b) => (
					sortItems(a, b, value)
				))
			}
			setFilteredItems(result)
		}
	}, [items, debouncedValue])

	useEffect(() => {
		if (highlightedIndex !== null) {
			ensureHighlightedIndex()
		} else if (autoHighlight) {
			maybeAutoCompleteText()
		}
	}, [highlightedIndex, autoHighlight])

	useEffect(() => {
		if (autoHighlight) {
			maybeAutoCompleteText()
		}
	}, [autoHighlight, debouncedValue])

	const keyDownHandlers = {
		ArrowDown(event) {
			event.preventDefault()
			if (!filteredItems.length) return
			let index = highlightedIndex === null ? -1 : highlightedIndex
			for (let i = 0; i < filteredItems.length; i++) {
				const p = (index + i + 1) % filteredItems.length
				if (isItemSelectable(filteredItems[p])) {
					index = p
					break
				}
			}
			if (index > -1 && index !== highlightedIndex) {
				setHighlightedIndex(index)
				setOpen(true)
			}
		},

		ArrowUp(event) {
			event.preventDefault()
			if (!filteredItems.length) return
			let index = highlightedIndex === null ? filteredItems.length : highlightedIndex
			for (let i = 0; i < filteredItems.length; i++) {
				const p = (index - (1 + i) + filteredItems.length) % filteredItems.length
				if (isItemSelectable(filteredItems[p])) {
					index = p
					break
				}
			}
			if (index !== filteredItems.length) {
				setHighlightedIndex(index)
				setOpen(true)
			}
		},

		Enter(event) {
			// Key code 229 is used for selecting items from character selectors (Pinyin, Kana, etc)
			if (event.keyCode !== 13) return
			// In case the user is currently hovering over the menu
			setIgnoreBlur(false)
			if (!isOpen) {
				// menu is closed so there is no selection to accept -> do nothing
			} else if (highlightedIndex == null) {
				// input has focus but no menu item is selected + enter is hit -> close the menu, highlight whatever's in input
				setOpen(false)
				refInput.current.select()
				if (allowSelectNothing) {
					onSelect(null)
				}
			} else {
				// text entered + menu item has been highlighted + enter is hit -> update value to that of selected menu item, close the menu
				event.preventDefault()
				const item = filteredItems[highlightedIndex]
				const value = getItemValue(item)
				setOpen(false)
				setHighlightedIndex(null)
				refInput.current.setSelectionRange(
					value.length,
					value.length
				)
				onSelect(value, item)
			}
		},

		Escape() {
			// In case the user is currently hovering over the menu
			setIgnoreBlur(false)
			setHighlightedIndex(null)
			setOpen(false)
		},

		Tab() {
			// In case the user is currently hovering over the menu
			setIgnoreBlur(false)
		},
	}

	useEffect(() => {
		updateMenuPositions()
		onMenuVisibilityChange(isOpen)
	}, [isOpen])

	const handleKeyDown = (event) => {
		if (keyDownHandlers[event.key])
			keyDownHandlers[event.key].call(null, event)
		else if (!isOpen) {
			setOpen(true)
		}
	}

	const handleChange = (event) => {
		setValue(event.target.value)
	}

	const maybeAutoCompleteText = () => {
		let index = highlightedIndex === null ? 0 : highlightedIndex
		for (let i = 0; i < filteredItems.length; i++) {
			if (isItemSelectable(filteredItems[index]))
				break
			index = (index + 1) % filteredItems.length
		}
		const matchedItem = filteredItems[index] && isItemSelectable(filteredItems[index]) ? filteredItems[index] : null
		if (value !== '' && matchedItem) {
			const itemValue = getItemValue(matchedItem)
			const itemValueDoesMatch = (itemValue.toLowerCase().indexOf(
				value.toLowerCase()
			) === 0)
			if (itemValueDoesMatch) {
				setHighlightedIndex(index)
			}
		}
		return setHighlightedIndex(null)
	}

	const ensureHighlightedIndex = () => {
		if (highlightedIndex >= filteredItems.length) {
			setHighlightedIndex(null)
		}
	}

	const updateMenuPositions = () => {
		const node = refInput.current
		const rect = node.getBoundingClientRect()
		const computedStyle = window.getComputedStyle(node)
		const marginBottom = parseInt(computedStyle.marginBottom, 10) || 0
		const marginLeft = parseInt(computedStyle.marginLeft, 10) || 0
		const marginRight = parseInt(computedStyle.marginRight, 10) || 0
		setMenuPosition({
			top: rect.bottom + marginBottom,
			left: rect.left + marginLeft,
			minWidth: rect.width + marginLeft + marginRight
		})
	}

	const highlightItemFromMouse = (index) => {
		setHighlightedIndex(index)
	}

	const selectItemFromMouse = (item) => {
		const value = getItemValue(item)
		// The menu will de-render before a mouseLeave event
		// happens. Clear the flag to release control over focus
		setIgnoreBlur(false)
		setOpen(false)
		setHighlightedIndex(null)
		onSelect(value, item)
	}

	const _renderMenu = () => {
		const items = filteredItems.map((item, index) =>
			_renderItem(
				item,
				isOpen && highlightedIndex === index,
				{ cursor: 'default' },
				index
			)
		)
		return React.cloneElement(
			renderMenu(items, value, {
				...menuStyle,
				...menuPosition,
			}),
			{
				ref: refMenu,
				// Ignore blur to prevent menu from de-rendering before we can process click
				onTouchStart: () => setIgnoreBlur(true),
				onMouseEnter: () => setIgnoreBlur(true),
				onMouseLeave: () => setIgnoreBlur(false),
			})
	}

	const _renderItem = (item, active, style, index) => {
		return (
			<Item active={active} item={item} refMenu={refMenu} renderItem={renderItem} style={style}
						key={`item-${getItemValue(item)}`}
						onMouseEnter={isItemSelectable(item) ?
							() => highlightItemFromMouse(index) : null}
						onClick={isItemSelectable(item) ?
							() => selectItemFromMouse(item) : null}
			/>
		)
	}

	const handleInputBlur = (event) => {
		if (_ignoreBlur) {
			setIgnoreFocus(true)
			setScrollOffset(getScrollOffset())
			refInput.current.focus()
			return
		}
		setOpen(false)
		setHighlightedIndex(null)
		if (selectOnBlur && highlightedIndex !== null) {
			const item = filteredItems[highlightedIndex]
			const value = getItemValue(item)
			onSelect(value, item)
		}

		const { onBlur } = inputProps
		if (onBlur) {
			onBlur(event)
		}
	}

	const handleInputFocus = (event) => {
		if (_ignoreFocus) {
			setIgnoreFocus(false)
			const { x, y } = _scrollOffset
			setScrollOffset(null)
			// Focus will cause the browser to scroll the <input> into view.
			// This can cause the mouse coords to change, which in turn
			// could cause a new highlight to happen, cancelling the click
			// event (when selecting with the mouse)
			window.scrollTo(x, y)
			// Some browsers wait until all focus event handlers have been
			// processed before scrolling the <input> into view, so let's
			// scroll again on the next tick to ensure we're back to where
			// the user was before focus was lost. We could do the deferred
			// scroll only, but that causes a jarring split second jump in
			// some browsers that scroll before the focus event handlers
			// are triggered.
			useTimeout(() => {
				window.scrollTo(x, y)
			}, 0)
			return
		}
		setOpen(true)
		const { onFocus } = inputProps
		if (onFocus) {
			onFocus(event)
		}
	}

	const isInputFocused = () => {
		const el = refInput.current
		return el.ownerDocument && (el === el.ownerDocument.activeElement)
	}

	const handleInputClick = () => {
		// Input will not be focused if it's disabled
		if (isInputFocused() && !isOpen)
			setOpen(true)
	}

	const composeEventHandlers = (internal, external) => {
		return external
			? e => {
				internal(e)
				external(e)
			}
			: internal
	}


	if (debug) { // you don't like it, you love it
		// eslint-disable-next-line no-console
		console.debug({
			isOpen,
			highlightedIndex,
			inputProps,
			wrapperProps,
			_ignoreBlur,
			_scrollOffset,
			_ignoreFocus,
			menuPosition
		})
	}

	return (
		<div style={{ ...wrapperStyle }} {...wrapperProps}>
			{renderInput({
				...inputProps,
				role: 'combobox',
				'aria-autocomplete': 'list',
				'aria-expanded': isOpen,
				autoComplete: 'off',
				ref: refInput,
				onFocus: handleInputFocus,
				onBlur: handleInputBlur,
				onChange: handleChange,
				onKeyDown: composeEventHandlers(handleKeyDown, inputProps.onKeyDown),
				onClick: composeEventHandlers(handleInputClick, inputProps.onClick),
				val,
			})}
			{isOpen && _renderMenu()}
		</div>
	)

}


Autocomplete.propTypes = {
	/**
	 * The items to display in the dropdown menu
	 */
	items: PropTypes.array.isRequired,
	/**
	 * The value to display in the input field
	 */
	value: PropTypes.any,
	/**
	 * Arguments: `event: Event, value: String`
	 *
	 * Invoked every time the user changes the input's value.
	 */
	onChange: PropTypes.func,
	/**
	 * Arguments: `value: String, item: Any`
	 *
	 * Invoked when the user selects an item from the dropdown menu.
	 */
	onSelect: PropTypes.func,
	/**
	 * Arguments: `item: Any, value: String`
	 *
	 * Invoked for each entry in `items` and its return value is used to
	 * determine whether or not it should be displayed in the dropdown menu.
	 * By default all items are always rendered.
	 */
	shouldItemRender: PropTypes.func,
	/**
	 * Arguments: `item: Any`
	 *
	 * Invoked when attempting to select an item. The return value is used to
	 * determine whether the item should be selectable or not.
	 * By default all items are selectable.
	 */
	isItemSelectable: PropTypes.func,
	/**
	 * Arguments: `itemA: Any, itemB: Any, value: String`
	 *
	 * The function which is used to sort `items` before display.
	 */
	sortItems: PropTypes.func,
	/**
	 * Arguments: `item: Any`
	 *
	 * Used to read the display value from each entry in `items`.
	 */
	getItemValue: PropTypes.func.isRequired,
	/**
	 * Arguments: `item: Any, isHighlighted: Boolean, styles: Object`
	 *
	 * Invoked for each entry in `items` that also passes `shouldItemRender` to
	 * generate the render tree for each item in the dropdown menu. `styles` is
	 * an optional set of styles that can be applied to improve the look/feel
	 * of the items in the dropdown menu.
	 */
	renderItem: PropTypes.func.isRequired,
	/**
	 * Arguments: `items: Array<Any>, value: String, styles: Object`
	 *
	 * Invoked to generate the render tree for the dropdown menu. Ensure the
	 * returned tree includes every entry in `items` or else the highlight order
	 * and keyboard navigation logic will break. `styles` will contain
	 * { top, left, minWidth } which are the coordinates of the top-left corner
	 * and the width of the dropdown menu.
	 */
	renderMenu: PropTypes.func,
	/**
	 * Styles that are applied to the dropdown menu in the default `renderMenu`
	 * implementation. If you override `renderMenu` and you want to use
	 * `menuStyle` you must manually apply them (`this.props.menuStyle`).
	 */
	menuStyle: PropTypes.object,
	/**
	 * Arguments: `props: Object`
	 *
	 * Invoked to generate the input element. The `props` argument is the result
	 * of merging `props.inputProps` with a selection of props that are required
	 * both for functionality and accessibility. At the very least you need to
	 * apply `props.ref` and all `props.on<event>` event handlers. Failing to do
	 * this will cause `Autocomplete` to behave unexpectedly.
	 */
	renderInput: PropTypes.func,
	/**
	 * Props passed to `props.renderInput`. By default these props will be
	 * applied to the `<input />` element rendered by `Autocomplete`, unless you
	 * have specified a custom value for `props.renderInput`. Any properties
	 * supported by `HTMLInputElement` can be specified, apart from the
	 * following which are set by `Autocomplete`: value, autoComplete, role,
	 * aria-autocomplete. `inputProps` is commonly used for (but not limited to)
	 * placeholder, event handlers (onFocus, onBlur, etc.), autoFocus, etc..
	 */
	inputProps: PropTypes.object,
	/**
	 * Props that are applied to the element which wraps the `<input />` and
	 * dropdown menu elements rendered by `Autocomplete`.
	 */
	wrapperProps: PropTypes.object,
	/**
	 * This is a shorthand for `wrapperProps={{ style: <your styles> }}`.
	 * Note that `wrapperStyle` is applied before `wrapperProps`, so the latter
	 * will win if it contains a `style` entry.
	 */
	wrapperStyle: PropTypes.object,
	/**
	 * Whether or not to automatically highlight the top match in the dropdown
	 * menu.
	 */
	autoHighlight: PropTypes.bool,
	/**
	 * Whether or not to automatically select the highlighted item when the
	 * `<input>` loses focus.
	 */
	selectOnBlur: PropTypes.bool,
	/**
	 * Arguments: `isOpen: Boolean`
	 *
	 * Invoked every time the dropdown menu's visibility changes (i.e. every
	 * time it is displayed/hidden).
	 */
	onMenuVisibilityChange: PropTypes.func,
	/**
	 * Used to override the internal logic which displays/hides the dropdown
	 * menu. This is useful if you want to force a certain state based on your
	 * UX/business logic. Use it together with `onMenuVisibilityChange` for
	 * fine-grained control over the dropdown menu dynamics.
	 */
	open: PropTypes.bool,
	debug: PropTypes.bool,
}

Autocomplete.defaultProps = {
	value: '',
	wrapperProps: {},
	wrapperStyle: {
		display: 'inline-block'
	},
	inputProps: {},
	renderInput(props) {
		return <input {...props} />
	},
	onChange() {
	},
	onSelect() {
	},
	isItemSelectable() {
		return true
	},
	renderMenu(items, value, style) {
		return <div style={{ ...style }} children={items}/>
	},
	menuStyle: {
		borderRadius: '3px',
		boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
		background: 'rgba(255, 255, 255, 0.9)',
		padding: '2px 0',
		fontSize: '90%',
		position: 'fixed',
		overflow: 'auto',
		maxHeight: '50%', // TODO: don't cheat, let it flow to the bottom
	},
	open: false,
	autoHighlight: true,
	selectOnBlur: false,
	onMenuVisibilityChange() {
	},
}


export default Autocomplete

