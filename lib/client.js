window.__ModuleLoader__.load({
	id: "dsh-model-order",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/order.ts
		/**
		* Natural-order, case-insensitive comparator.
		*
		* `numeric: true` is what makes `m2` sort before `m10`, which is the ordering a
		* human reading a model list expects (`gemini-3.8-flash` before
		* `gemini-10-flash`). `sensitivity: 'base'` makes the comparison case-insensitive
		* without ignoring accents.
		*/
		const collator = new Intl.Collator(void 0, {
			numeric: true,
			sensitivity: "base"
		});
		/**
		* The label a row is shown and sorted by.
		*
		* A non-blank `name` wins; otherwise the entry falls back to its `id`. Only a
		* string counts on either side, so a malformed entry yields an empty label
		* rather than throwing or leaking a non-string into the comparator.
		*/
		function displayLabelOf(model) {
			const name = model.name;
			if (typeof name === "string" && name.trim().length > 0) return name;
			const id = model.id;
			return typeof id === "string" ? id : "";
		}
		/** Whether `from` addresses an existing entry. */
		function isValidIndex(length, from) {
			return Number.isInteger(from) && from >= 0 && from < length;
		}
		/**
		* Whether a move request would leave the order unchanged.
		*
		* The UI uses this to disable a button that could not do anything, and the
		* mutator uses it to return an untouched copy instead of churning a write.
		*/
		function isNoopMove(length, from, move) {
			if (!isValidIndex(length, from)) return true;
			if (move === "up") return from === 0;
			if (move === "top") return from === 0;
			if (move === "down") return from === length - 1;
			return from === length - 1;
		}
		/**
		* The destination index of a move, expressed in the *original* coordinate space.
		*
		* This is deliberately the coordinate space of the array as it stands before the
		* move: the caller removes the entry first, then inserts it at this index. For a
		* downward move that works out because removing an earlier entry shifts the
		* successor down by one, so inserting at `from + 1` lands the entry immediately
		* after it.
		*/
		function targetIndexOf(length, from, move) {
			if (move === "up") return from - 1;
			if (move === "down") return from + 1;
			if (move === "top") return 0;
			return length - 1;
		}
		/**
		* Move the entry at `from` according to `move`, returning a new array.
		*
		* The returned array is a permutation of the input: same length, same entry
		* objects, same relative order for every entry that did not move. Out-of-range,
		* fractional and `NaN` indices degrade to an untouched copy rather than throwing,
		* so a stale render can never crash the settings page.
		*
		* @param models - the provider's effective `models` array, read-only.
		* @param from - index of the entry to move in `models`.
		* @param move - which direction the entry should travel.
		* @returns a new array with the entry relocated; the input is never modified.
		*/
		function moveModel(models, from, move) {
			const next = [...models];
			if (isNoopMove(next.length, from, move)) return next;
			const moved = next[from];
			if (moved === void 0) return next;
			const to = targetIndexOf(next.length, from, move);
			next.splice(from, 1);
			next.splice(to, 0, moved);
			return next;
		}
		/**
		* Sort entries by their display label, returning a new array.
		*
		* Ties are broken by the entry's original position, which makes the sort
		* explicitly stable: entries sharing a name keep the order the user gave them,
		* so pressing the button twice cannot shuffle them.
		*
		* @param models - the provider's effective `models` array, read-only.
		* @returns a new, name-ordered array sharing the input's entry objects.
		*/
		function sortModelsByName(models) {
			return models.map((model, index) => ({
				model,
				index
			})).sort((left, right) => {
				const byLabel = collator.compare(displayLabelOf(left.model), displayLabelOf(right.model));
				return byLabel !== 0 ? byLabel : left.index - right.index;
			}).map((entry) => entry.model);
		}
		/**
		* Put entries back into a previously captured order, matched by entry id.
		*
		* This backs the card's "undo this change" affordance for routes that must not
		* be reset: it restores an ordering the user already had, and never removes an
		* entry, so it cannot lose a hand-written model.
		*
		* Matching is by id rather than by object identity on purpose — a settings
		* write round-trips through the Host, so the entries that come back are equal
		* in content but not the same objects as the ones captured.
		*
		* @param models - the route's current models array, read-only.
		* @param baseline - the id order captured when the card first saw the route.
		*                   An empty or absent capture makes this a plain copy.
		* @returns a new array: entries the capture knows come first in captured order,
		*          entries it does not know follow in their current relative order.
		*/
		function restoreOrder(models, baseline) {
			if (baseline === void 0 || baseline.length === 0) return [...models];
			const rank = /* @__PURE__ */ new Map();
			for (const [index, id] of baseline.entries()) if (!rank.has(id)) rank.set(id, index);
			return models.map((model, index) => {
				const id = model.id;
				return {
					model,
					index,
					position: (typeof id === "string" ? rank.get(id) : void 0) ?? Number.POSITIVE_INFINITY
				};
			}).sort((left, right) => left.position - right.position || left.index - right.index).map((entry) => entry.model);
		}
		//#endregion
		//#region src/client/section.ts
		/**
		* Read an own property off a JSON-shaped value.
		*
		* @param value - the container; anything that is not an object reads as absent.
		* @param key - the property name, taken verbatim from the route id.
		* @returns the own value, or `undefined` when the container is not an object or
		*          simply does not carry the key as its own.
		*/
		function ownProperty(value, key) {
			if (typeof value !== "object" || value === null) return void 0;
			if (!Object.hasOwn(value, key)) return void 0;
			return value[key];
		}
		/**
		* The path of one route's models array inside the namespace section.
		*
		* The pi-ai adapter publishes `settingsPath: ['providers', route]` for every
		* configurable route, so the models list sits one key beneath it.
		*
		* @param route - the provider route id (for example `router`).
		* @returns the absolute path from the section root.
		*/
		function modelsPathOf(route) {
			return [
				"providers",
				route,
				"models"
			];
		}
		/**
		* The user layer's stored profile object for one route.
		*
		* @param userSection - the namespace's raw user layer, as the form exposes it.
		* @param route - the provider route id.
		* @returns the stored profile object itself, or `undefined` when the user layer
		*          declares none. Arrays and primitives are not profiles.
		*/
		function userProfileOf(userSection, route) {
			const profile = ownProperty(ownProperty(userSection, "providers"), route);
			if (typeof profile !== "object" || profile === null || Array.isArray(profile)) return void 0;
			return profile;
		}
		/**
		* The user layer's stored models array for one route, if it declares one.
		*
		* `undefined` means the route carries no array of its own and therefore serves
		* whatever it inherits — the state in which this plugin has nothing to reorder
		* and shows no ordering controls. An empty array is a declared override and
		* comes back as an empty array.
		*
		* The stored array is returned by reference: callers display exactly what is
		* stored, and the reorder functions in `order.ts` never mutate it.
		*
		* @param userSection - the namespace's raw user layer.
		* @param route - the provider route id.
		* @returns the stored array, or `undefined` when the route declares none.
		*/
		function userModelsOf(userSection, route) {
			const models = ownProperty(userProfileOf(userSection, route), "models");
			return Array.isArray(models) ? models : void 0;
		}
		/**
		* The edit that replaces one route's models array with `models`.
		*
		* @param route - the provider route id.
		* @param models - the new ordering; passed through without copying so the
		*                 caller keeps ownership of what it sends.
		* @returns a single whole-array `set` op.
		*/
		function setModelsOp(route, models) {
			return {
				op: "set",
				path: modelsPathOf(route),
				value: models
			};
		}
		/**
		* The edit that removes one route's models override, returning it to whatever
		* it inherits.
		*
		* **Only safe for a route pi-ai ships a catalog for** — see
		* {@link canRestoreInheritance}. For a hand-declared route the pi-ai adapter
		* refuses to resolve an empty model list at all ("the installed catalog does
		* not describe this route, so its models must be listed in configuration"), so
		* unsetting would leave the provider serving nothing.
		*
		* @param route - the provider route id.
		* @returns a single `unset` op at the models path.
		*/
		function unsetModelsOp(route) {
			return {
				op: "unset",
				path: modelsPathOf(route)
			};
		}
		/**
		* Whether dropping a route's models override is safe.
		*
		* The provider directory's `declared` flag marks exactly the routes the
		* installed pi-ai catalog does not describe (the adapter computes it as
		* `!catalog.has(provider)`). Such a route has nothing to fall back to, so its
		* override must stay.
		*
		* @param declared - the directory entry's `declared` flag, when present.
		* @returns `true` for a catalog-backed route, `false` for a hand-declared one.
		*/
		function canRestoreInheritance(declared) {
			return declared !== true;
		}
		//#endregion
		//#region src/client/copy.ts
		const DICT = {
			title: {
				en: "Model order",
				zh: "模型排序"
			},
			intro: {
				en: "This order is what the composer model menu shows. Only the order changes; no model is added, removed or edited.",
				zh: "此顺序即消息框模型菜单显示的顺序。只调整先后次序，不新增、不删除、不修改任何模型。"
			},
			position: {
				en: "Position",
				zh: "序号"
			},
			moveUp: {
				en: "Move up",
				zh: "上移"
			},
			moveDown: {
				en: "Move down",
				zh: "下移"
			},
			moveTop: {
				en: "Move to top",
				zh: "置顶"
			},
			moveBottom: {
				en: "Move to bottom",
				zh: "置底"
			},
			sortByName: {
				en: "Sort by name",
				zh: "按名称排序"
			},
			restore: {
				en: "Restore default order",
				zh: "恢复默认顺序"
			},
			restoreArmed: {
				en: "Click again to confirm",
				zh: "再点一次确认"
			},
			restoreHint: {
				en: "Removes this route’s model list, so it falls back to the models pi-ai ships.",
				zh: "移除该路由的模型列表，回到 pi-ai 内置目录。"
			},
			restoreBlocked: {
				en: "Unavailable here: this route is declared by configuration and pi-ai ships no catalog for it, so removing its model list would leave it with no models at all.",
				zh: "此处不可用：该路由由配置声明、pi-ai 内置目录不覆盖它，移除模型列表会让它一个模型都不剩。"
			},
			undo: {
				en: "Undo this change",
				zh: "撤销本次更改"
			},
			undoHint: {
				en: "Puts the list back into the order it had when this card was opened. Nothing is removed.",
				zh: "把列表恢复到打开这张卡片时的顺序，不删除任何内容。"
			},
			undoNothing: {
				en: "The order already matches the one this card was opened with.",
				zh: "当前顺序已经和打开卡片时一致。"
			},
			hidden: {
				en: "This route has no model list of its own — it serves the models pi-ai ships, so there is nothing to reorder here.",
				zh: "该路由没有自己的模型列表（沿用 pi-ai 内置目录），因此没有可排序的内容。"
			},
			empty: {
				en: "This route declares an empty model list.",
				zh: "该路由声明了一个空的模型列表。"
			},
			loading: {
				en: "Reading settings…",
				zh: "正在读取设置…"
			},
			readOnly: {
				en: "Settings are read-only here, so the order cannot be changed.",
				zh: "当前设置为只读，无法调整顺序。"
			},
			busy: {
				en: "Saving…",
				zh: "保存中…"
			},
			refused: {
				en: "The Host refused the change. The list below shows the stored order again.",
				zh: "Host 拒绝了这次改动，下方已回到存储中的顺序。"
			},
			conflict: {
				en: "The settings changed elsewhere, so this edit was refused rather than overwriting it. Try again on the refreshed list.",
				zh: "设置在别处被改动，本次编辑被拒绝以免覆盖，请基于刷新后的列表重试。"
			},
			applied: {
				en: "Order saved.",
				zh: "顺序已保存。"
			}
		};
		/**
		* Whether the page is presenting Chinese.
		*
		* Read from the document first (the page sets its own language) and fall back
		* to the browser's preference; anything unresolved stays English.
		*
		* @returns whether Chinese copy should be used.
		*/
		function prefersChinese() {
			if (typeof document !== "undefined") {
				const lang = document.documentElement?.lang;
				if (typeof lang === "string" && lang.length > 0) return /^zh/i.test(lang);
			}
			if (typeof navigator !== "undefined") {
				const lang = navigator.language;
				if (typeof lang === "string" && lang.length > 0) return /^zh/i.test(lang);
			}
			return false;
		}
		/**
		* Resolve one copy key for the current page language.
		*
		* @param key - the copy key.
		* @param chinese - whether Chinese is preferred; read from the page when omitted.
		* @returns the localized string.
		*/
		function t(key, chinese = prefersChinese()) {
			const pair = DICT[key];
			return chinese ? pair.zh : pair.en;
		}
		//#endregion
		//#region \0dsh-model-order-css:C:\Users\WY\.codex\worktrees\9593\AI_Space\dsh-model-order\src\client\order-card.module.css.mjs
		const css = ".Ix4reG_section{border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l3));border-radius:var(--dsw-radius-lg,10px);flex-direction:column;gap:8px;padding:10px 12px;display:flex}.Ix4reG_head{align-items:center;gap:8px;display:flex}.Ix4reG_title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}.Ix4reG_headActions{align-items:center;gap:4px;margin-left:auto;display:inline-flex}.Ix4reG_intro,.Ix4reG_note{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.Ix4reG_intro{color:var(--dsw-alias-label-secondary)}.Ix4reG_failure{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:18px}.Ix4reG_saved{color:var(--dsw-alias-state-success-primary);margin:0;font-size:12px;line-height:18px}.Ix4reG_list{flex-direction:column;gap:4px;margin:0;padding:0;list-style:none;display:flex}.Ix4reG_row{align-items:center;gap:8px;min-height:28px;display:flex}.Ix4reG_position{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;text-align:right;flex:none;width:20px;font-size:12px}.Ix4reG_label{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:13px;line-height:20px;overflow:hidden}.Ix4reG_actions{flex:none;align-items:center;gap:2px;margin-left:auto;display:inline-flex}.Ix4reG_button{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,6px);color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;background:0 0;justify-content:center;align-items:center;min-width:24px;height:24px;padding:0 6px;font-size:12px;line-height:16px;display:inline-flex}.Ix4reG_button:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary)}.Ix4reG_button:focus-visible{outline:2px solid var(--dsw-alias-state-focus-primary,var(--dsw-alias-state-brand-primary));outline-offset:1px}.Ix4reG_button:disabled{color:var(--dsw-alias-label-quaternary,var(--dsw-alias-label-tertiary));cursor:default;opacity:.5}.Ix4reG_buttonArmed{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}.Ix4reG_link{box-sizing:border-box;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;background:0 0;border:none;padding:0;font-size:12px;line-height:18px;text-decoration:underline}.Ix4reG_link:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.Ix4reG_link:disabled{color:var(--dsw-alias-label-quaternary,var(--dsw-alias-label-tertiary));cursor:default;text-decoration:none}";
		const tagId = "dsh-model-order/order-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-model-order";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var order_card_module_css_default = {
			"title": "Ix4reG_title",
			"headActions": "Ix4reG_headActions",
			"label": "Ix4reG_label",
			"row": "Ix4reG_row",
			"section": "Ix4reG_section",
			"position": "Ix4reG_position",
			"list": "Ix4reG_list",
			"buttonArmed": "Ix4reG_buttonArmed",
			"link": "Ix4reG_link",
			"note": "Ix4reG_note",
			"failure": "Ix4reG_failure",
			"actions": "Ix4reG_actions",
			"head": "Ix4reG_head",
			"intro": "Ix4reG_intro",
			"button": "Ix4reG_button",
			"saved": "Ix4reG_saved"
		};
		//#endregion
		//#region src/client/ModelOrderCard.tsx
		/**
		* dsh-model-order — the ordering area rendered inside one provider card.
		*
		* The official Models page declares `settings.models.provider-card` for plugins
		* distributed outside its repository, and dispatches it once per provider card
		* with that row's directory entry. This component is that contribution.
		*
		* Two facts shape everything here:
		*
		* - **The seat renders its own block.** A slot registrant owns its own DOM; it
		*   cannot reach into the card's model rows. So the area lists the route's
		*   entries itself rather than decorating the official rows.
		* - **Only the order changes.** Every action funnels into one whole-array
		*   replacement built by `section.ts`, over entries read straight from the user
		*   layer, moved by `order.ts` — a permutation of the user's own objects.
		*/
		/** Stable id text of one entry; an unusable id is simply not matchable. */
		function idOf(entry) {
			return typeof entry.id === "string" ? entry.id : "";
		}
		const MOVE_BUTTONS = [
			{
				move: "up",
				key: "moveUp",
				glyph: "↑"
			},
			{
				move: "down",
				key: "moveDown",
				glyph: "↓"
			},
			{
				move: "top",
				key: "moveTop",
				glyph: "⇈"
			},
			{
				move: "bottom",
				key: "moveBottom",
				glyph: "⇊"
			}
		];
		/**
		* The provider-card extension area.
		*
		* @param props - the slot's owner share plus the injected business face.
		*/
		function ModelOrderCard(props) {
			const snapshot = (0, react.useSyncExternalStore)(props.subscribe, props.getSnapshot, props.getSnapshot);
			const route = props.provider.provider;
			const models = (0, react.useMemo)(() => userModelsOf(snapshot.user, route), [snapshot.user, route]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(null);
			const [saved, setSaved] = (0, react.useState)(false);
			const [armed, setArmed] = (0, react.useState)(false);
			const baseline = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (models === void 0) {
					baseline.current = null;
					return;
				}
				if (baseline.current?.route !== route) baseline.current = {
					route,
					ids: models.map(idOf)
				};
			}, [models, route]);
			(0, react.useEffect)(() => {
				setArmed(false);
				setFailure(null);
			}, [route]);
			const readOnly = snapshot.status !== "ready" || !snapshot.writable || snapshot.mode !== "host";
			const runWrite = (0, react.useCallback)(async (ops) => {
				const readAt = props.getSnapshot().revision;
				setBusy(true);
				setFailure(null);
				setSaved(false);
				try {
					if (await props.apply(ops, readAt)) {
						setSaved(true);
						return;
					}
					const advanced = props.getSnapshot().revision !== readAt;
					setFailure(t(advanced ? "conflict" : "refused"));
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
					setArmed(false);
				}
			}, [props.apply, props.getSnapshot]);
			if (!props.configured) return null;
			if (snapshot.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: order_card_module_css_default.section,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: order_card_module_css_default.note,
					children: t("loading")
				})
			});
			if (models === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: order_card_module_css_default.section,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: order_card_module_css_default.note,
					children: t("hidden")
				})
			});
			const disabled = readOnly || busy;
			const baselineIds = baseline.current?.route === route ? baseline.current.ids : void 0;
			const undoable = baselineIds !== void 0 && models.map(idOf).join("\0") !== baselineIds.join("\0");
			const restorable = canRestoreInheritance(props.provider.declared);
			const list = models;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: order_card_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: order_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: order_card_module_css_default.title,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: order_card_module_css_default.headActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: order_card_module_css_default.link,
								disabled: disabled || list.length < 2,
								onClick: () => {
									runWrite([setModelsOp(route, sortModelsByName(list))]);
								},
								children: t("sortByName")
							}), restorable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: armed ? `${order_card_module_css_default.link} ${order_card_module_css_default.buttonArmed}` : order_card_module_css_default.link,
								disabled,
								title: t("restoreHint"),
								onClick: () => {
									if (!armed) {
										setArmed(true);
										return;
									}
									runWrite([unsetModelsOp(route)]);
								},
								children: armed ? t("restoreArmed") : t("restore")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: order_card_module_css_default.link,
								disabled: disabled || !undoable,
								title: undoable ? t("undoHint") : t("undoNothing"),
								onClick: () => {
									runWrite([setModelsOp(route, restoreOrder(list, baselineIds))]);
								},
								children: t("undo")
							})]
						})]
					}),
					readOnly ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: order_card_module_css_default.note,
						children: t("readOnly")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: order_card_module_css_default.intro,
						children: t("intro")
					}),
					!restorable && !readOnly ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: order_card_module_css_default.note,
						children: t("restoreBlocked")
					}) : null,
					failure !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: order_card_module_css_default.failure,
						children: failure
					}) : null,
					saved && failure === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: order_card_module_css_default.saved,
						children: t("applied")
					}) : null,
					list.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: order_card_module_css_default.note,
						children: t("empty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: order_card_module_css_default.list,
						children: list.map((entry, index) => {
							const label = displayLabelOf(entry) || `#${String(index + 1)}`;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: order_card_module_css_default.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: order_card_module_css_default.position,
										"aria-hidden": "true",
										children: index + 1
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: order_card_module_css_default.label,
										title: label,
										children: label
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: order_card_module_css_default.actions,
										children: MOVE_BUTTONS.map((button) => {
											const blocked = disabled || isNoopMove(list.length, index, button.move);
											const text = t(button.key);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: order_card_module_css_default.button,
												disabled: blocked,
												"aria-label": `${text}: ${label}`,
												title: text,
												onClick: () => {
													runWrite([setModelsOp(route, moveModel(list, index, button.move))]);
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													"aria-hidden": "true",
													children: button.glyph
												})
											}, button.move);
										})
									})
								]
							}, idOf(entry) !== "" ? `${idOf(entry)}-${String(index)}` : `at-${String(index)}`);
						})
					}),
					busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: order_card_module_css_default.note,
						children: t("busy")
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Stable plugin name; matches the host half and the bundle patch entry id. */
		const name = "dsh-model-order";
		/** Cordis services this fiber needs before `apply` runs. */
		const inject = ["slots", "configForms"];
		/**
		* Settings namespaces whose provider cards receive the ordering area.
		*
		* The pi-ai adapter publishes its settings namespace as its own loader entry
		* id, which the shipped profile spells `llm-pi-ai` and the profile patch layer
		* pins. A deployment that renames the entry would need the matching name here;
		* the area simply would not be dispatched otherwise, and nothing else breaks.
		*/
		const PROVIDER_NAMESPACES = ["llm-pi-ai"];
		/**
		* Bind one namespace's settings form to the small face the card consumes.
		*
		* The seam's op type and this plugin's `PathOp` describe the same two shapes;
		* they differ only in how precisely the `set` value is typed (`JsonValue`
		* versus `unknown`, since entries are user-authored and validated by the Host,
		* not here). The conversion is therefore structural and happens once, at this
		* boundary, instead of loosening the tested types upstream.
		*
		* @param ctx - the plugin's client context.
		* @param namespace - the settings namespace to edit.
		* @returns the face injected into the card's props.
		*/
		function createFace(ctx, namespace) {
			const form = ctx.configForms.get(namespace);
			return {
				getSnapshot: () => form.getSnapshot(),
				subscribe: (listener) => form.subscribe(listener),
				apply: (ops, expectedRevision) => form.mutate(ops, expectedRevision)
			};
		}
		/**
		* Register the ordering area for every managed namespace.
		*
		* @param ctx - the plugin's client context.
		*/
		function apply(ctx) {
			for (const namespace of PROVIDER_NAMESPACES) {
				const face = createFace(ctx, namespace);
				ctx.effect(() => ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
					name: "settings.models.provider-card",
					key: namespace,
					registrant: name,
					inject: () => face
				}, ModelOrderCard)));
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map