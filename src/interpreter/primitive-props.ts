// JavaScriptは一部のUnicode文字列を正しく扱えないため標準関数の代わりにstringzの関数を使う
import { substring, length, indexOf, toArray } from 'stringz';
import { AiScriptRuntimeError } from '../error.js';
import { textEncoder } from '../const.js';
import { assertArray, assertBoolean, assertFunction, assertNumber, assertString, expectAny, eq } from './util.js';
import { ARR, FALSE, FN_NATIVE, NULL, NUM, STR, TRUE } from './value.js';
import type { Value, VArr, VFn, VNum, VStr, VError } from './value.js';

type VWithPP = VNum|VStr|VArr|VError;

const PRIMITIVE_PROPS: {
	[key in VWithPP['type']]: { [key: string]: (target: Value) => Value }
} = {
	num: {
		to_str: (target: VNum): VFn => FN_NATIVE(async (_, _opts) => {
			return STR(target.value.toString());
		}),
	},

	str: {
		to_num: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			const parsed = parseInt(target.value, 10);
			if (isNaN(parsed)) return NULL;
			return NUM(parsed);
		}),

		to_arr: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return ARR(toArray(target.value).map(s => STR(s)));
		}),

		to_unicode_arr: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return ARR([...target.value].map((s) => STR(s)));
		}),

		to_unicode_codepoint_arr: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return ARR([...target.value].map((s) => {
				const res = s.codePointAt(0);
				return NUM(res ?? s.charCodeAt(0));
			}));
		}),

		to_char_arr: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return ARR(target.value.split('').map((s) => STR(s)));
		}),

		to_charcode_arr: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return ARR(target.value.split('').map((s) => NUM(s.charCodeAt(0))));
		}),

		to_utf8_byte_arr: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return ARR(Array.from(textEncoder.encode(target.value)).map((s) => NUM(s)));
		}),

		len: (target: VStr): VNum => NUM(length(target.value)),

		replace: (target: VStr): VFn => FN_NATIVE(async ([a, b], _opts) => {
			assertString(a);
			assertString(b);
			return STR(target.value.split(a.value).join(b.value));
		}),

		index_of: (target: VStr): VFn => FN_NATIVE(async ([search, fromI], _opts) => {
			assertString(search);
			if (fromI) assertNumber(fromI);
			const pos = fromI ? (fromI.value < 0 ? target.value.length + fromI.value : fromI.value) : undefined;
			return NUM(indexOf(target.value, search.value, pos));
		}),

		incl: (target: VStr): VFn => FN_NATIVE(async ([search], _opts) => {
			assertString(search);
			return target.value.includes(search.value) ? TRUE : FALSE;
		}),

		trim: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return STR(target.value.trim());
		}),

		upper: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return STR(target.value.toUpperCase());
		}),

		lower: (target: VStr): VFn => FN_NATIVE(async (_, _opts) => {
			return STR(target.value.toLowerCase());
		}),

		split: (target: VStr): VFn => FN_NATIVE(async ([splitter], _opts) => {
			if (splitter) assertString(splitter);
			if (splitter) {
				return ARR(target.value.split(splitter ? splitter.value : '').map(s => STR(s)));
			} else {
				return ARR(toArray(target.value).map(s => STR(s)));
			}
		}),

		slice: (target: VStr): VFn => FN_NATIVE(async ([begin, end], _opts) => {
			assertNumber(begin);
			assertNumber(end);
			return STR(substring(target.value, begin.value, end.value));
		}),

		pick: (target: VStr): VFn => FN_NATIVE(async ([i], _opts) => {
			assertNumber(i);
			const chars = toArray(target.value);
			const char = chars[i.value];
			return char ? STR(char) : NULL;
		}),

		charcode_at: (target: VStr): VFn => FN_NATIVE(([i], _) => {
			assertNumber(i);

			const res = target.value.charCodeAt(i.value);

			return Number.isNaN(res) ? NULL : NUM(res);
		}),

		codepoint_at: (target: VStr): VFn => FN_NATIVE(([i], _) => {
			assertNumber(i);

			const res = target.value.codePointAt(i.value) ?? target.value.charCodeAt(i.value);
			return Number.isNaN(res) ? NULL : NUM(res);
		}),
	},

	arr: {
		len: (target: VArr): VNum => NUM(target.value.length),

		push: (target: VArr): VFn => FN_NATIVE(async ([val], _opts) => {
			expectAny(val);
			target.value.push(val);
			return target;
		}),

		unshift: (target: VArr): VFn => FN_NATIVE(async ([val], _opts) => {
			expectAny(val);
			target.value.unshift(val);
			return target;
		}),

		pop: (target: VArr): VFn => FN_NATIVE(async (_, _opts) => {
			return target.value.pop() ?? NULL;
		}),

		shift: (target: VArr): VFn => FN_NATIVE(async (_, _opts) => {
			return target.value.shift() ?? NULL;
		}),

		concat: (target: VArr): VFn => FN_NATIVE(async ([x], _opts) => {
			assertArray(x);
			return ARR(target.value.concat(x.value));
		}),

		slice: (target: VArr): VFn => FN_NATIVE(async ([begin, end], _opts) => {
			assertNumber(begin);
			assertNumber(end);
			return ARR(target.value.slice(begin.value, end.value));
		}),

		join: (target: VArr): VFn => FN_NATIVE(async ([joiner], _opts) => {
			if (joiner) assertString(joiner);
			return STR(target.value.map(i => i.type === 'str' ? i.value : '').join(joiner ? joiner.value : ''));
		}),

		map: (target: VArr): VFn => FN_NATIVE(async ([fn], opts) => {
			assertFunction(fn);
			const vals = target.value.map(async (item, i) => {
				return await opts.call(fn, [item, NUM(i)]);
			});
			return ARR(await Promise.all(vals));
		}),

		filter: (target: VArr): VFn => FN_NATIVE(async ([fn], opts) => {
			assertFunction(fn);
			const vals = [] as Value[];
			for (let i = 0; i < target.value.length; i++) {
				const item = target.value[i]!;
				const res = await opts.call(fn, [item, NUM(i)]);
				assertBoolean(res);
				if (res.value) vals.push(item);
			}
			return ARR(vals);
		}),

		reduce: (target: VArr): VFn => FN_NATIVE(async ([fn, initialValue], opts) => {
			assertFunction(fn);
			const withInitialValue = initialValue != null;
			let accumulator = withInitialValue ? initialValue : target.value[0]!;
			for (let i = withInitialValue ? 0 : 1; i < target.value.length; i++) {
				const item = target.value[i]!;
				accumulator = await opts.call(fn, [accumulator, item, NUM(i)]);
			}
			return accumulator;
		}),

		find: (target: VArr): VFn => FN_NATIVE(async ([fn], opts) => {
			assertFunction(fn);
			for (let i = 0; i < target.value.length; i++) {
				const item = target.value[i]!;
				const res = await opts.call(fn, [item, NUM(i)]);
				assertBoolean(res);
				if (res.value) return item;
			}
			return NULL;
		}),

		incl: (target: VArr): VFn => FN_NATIVE(async ([val], _opts) => {
			expectAny(val);
			return target.value.some(item => eq(val, item)) ? TRUE : FALSE;
		}),

		index_of: (target: VArr): VFn => FN_NATIVE(async ([val, fromI], _opts) => {
			expectAny(val);
			if (fromI) {
				assertNumber(fromI);
				const offset = target.value.slice(0, fromI.value).length;
				const result = target.value.slice(fromI.value).findIndex(v => eq(v, val));
				return NUM(result < 0 ? result : result + offset);
			} else {
				return NUM(target.value.findIndex(v => eq(v, val)));
			}
		}),

		reverse: (target: VArr): VFn => FN_NATIVE(async (_, _opts) => {
			target.value.reverse();
			return NULL;
		}),

		copy: (target: VArr): VFn => FN_NATIVE(async (_, _opts) => {
			return ARR([...target.value]);
		}),
		sort: (target: VArr): VFn => FN_NATIVE(async ([comp], opts) => {
			const mergeSort = async (arr: Value[], comp: VFn): Promise<Value[]> => {
				if (arr.length <= 1) return arr;
				const mid = Math.floor(arr.length / 2);
				const left = await mergeSort(arr.slice(0, mid), comp);
				const right = await mergeSort(arr.slice(mid), comp);
				return merge(left, right, comp);
			};
			const merge = async (left: Value[], right: Value[], comp: VFn): Promise<Value[]> => {
				const result: Value[] = [];
				let leftIndex = 0;
				let rightIndex = 0;
				while (leftIndex < left.length && rightIndex < right.length) {
					const l = left[leftIndex]!;
					const r = right[rightIndex]!;
					const compValue = await opts.call(comp, [l, r]);
					assertNumber(compValue);
					if (compValue.value < 0) {
						result.push(left[leftIndex]!);
						leftIndex++;
					} else {
						result.push(right[rightIndex]!);
						rightIndex++;
					}
				}
				return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
			};

			assertFunction(comp);
			assertArray(target);
			target.value = await mergeSort(target.value, comp);
			return target;
		}),
	},

	error: {
		name: (target: VError): VStr => STR(target.value), 

		info: (target: VError): Value => target.info ?? NULL,
	},
} as const;

export function getPrimProp(target: Value, name: string): Value {
	if (Object.hasOwn(PRIMITIVE_PROPS, target.type)) {
		const props = PRIMITIVE_PROPS[target.type as VWithPP['type']];
		if (Object.hasOwn(props, name)) {
			return props[name]!(target);
		} else {
			throw new AiScriptRuntimeError(`No such prop (${name}) in ${target.type}.`);
		}
	} else {
		throw new AiScriptRuntimeError(`Cannot read prop of ${target.type}. (reading ${name})`);
	}
}
