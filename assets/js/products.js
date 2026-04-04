document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initLeadForm();
    void initProductsPage();
});

const DEFAULT_PRODUCTS_API_CONFIG = {
    tabsUrl: "/api/projectCase/list/industry",
    listUrl: "/api/projectCase/list/industry",
    tabsMethod: "GET",
    listMethod: "GET",
    tabIdParam: "categoryId",
    tabSlugParam: "categoryCode",
    tabNameParam: "categoryName",
    pageSizeParam: "pageSize",
    pageSize: 12,
    tabsParams: null,
    listParams: null,
};

function initHeader() {
    const header = document.getElementById("header");
    const menuToggle = header ? header.querySelector(".header-menu-toggle") : null;
    const mobileMenuQuery = window.matchMedia("(max-width: 768px)");

    if (!header) {
        return;
    }

    const setMenuState = function (isOpen) {
        header.classList.toggle("menu-open", isOpen);
        document.body.classList.toggle("mobile-menu-open", isOpen && mobileMenuQuery.matches);

        if (menuToggle) {
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute("aria-label", isOpen ? "收起导航菜单" : "打开导航菜单");
        }
    };

    const closeMenu = function () {
        setMenuState(false);
    };

    const syncHeaderState = function () {
        header.classList.toggle("scrolled", window.scrollY > 24);

        if (!header.classList.contains("menu-open")) {
            document.body.classList.remove("mobile-menu-open");
        }
    };

    window.addEventListener("scroll", syncHeaderState, { passive: true });

    if (menuToggle) {
        menuToggle.addEventListener("click", function () {
            setMenuState(!header.classList.contains("menu-open"));
        });

        header.querySelectorAll(".nav a").forEach(function (link) {
            link.addEventListener("click", closeMenu);
        });

        header.querySelectorAll(".header-actions > .btn").forEach(function (button) {
            button.addEventListener("click", closeMenu);
        });

        document.addEventListener("click", function (event) {
            if (!mobileMenuQuery.matches || !header.classList.contains("menu-open")) {
                return;
            }

            if (!header.contains(event.target)) {
                closeMenu();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeMenu();
            }
        });

        window.addEventListener(
            "resize",
            debounce(function () {
                if (!mobileMenuQuery.matches) {
                    closeMenu();
                }

                syncHeaderState();
            }, 120)
        );
    }

    setMenuState(false);
    syncHeaderState();
}

function initLeadForm() {
    document.querySelectorAll(".lead-gen-form").forEach(function (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
        });
    });
}

async function initProductsPage() {
    const section = document.querySelector("[data-products-page]");
    const tabsContainer = section ? section.querySelector("[data-products-tabs]") : null;
    const listContainer = section ? section.querySelector("[data-products-list]") : null;
    const emptyState = section ? section.querySelector("[data-products-empty]") : null;
    const status = section ? section.querySelector("[data-products-status]") : null;

    if (!section || !tabsContainer || !listContainer) {
        return;
    }

    const apiConfig = getProductsApiConfig(section);
    const fallbackTabs = collectFallbackTabs(tabsContainer);
    const fallbackProducts = collectFallbackProducts(listContainer);
    let tabs = fallbackTabs.length ? fallbackTabs : [createDefaultAllTab()];
    let activeTab = getInitialActiveTab(tabs);
    let activeRequestId = 0;

    const updateTabs = function (nextTabs, nextActiveTab) {
        renderTabs(tabsContainer, nextTabs, nextActiveTab, function (tab) {
            if (isSameTab(tab, activeTab)) {
                return;
            }

            activeTab = tab;
            updateTabs(tabs, activeTab);
            void loadProductsByTab(activeTab);
        });
    };

    const loadProductsByTab = async function (tab) {
        const requestId = activeRequestId + 1;
        activeRequestId = requestId;
        setListLoading(listContainer, true);
        setStatus(status, "正在加载内容...");

        try {
            const products = await fetchProductsContent(apiConfig, tab);

            if (requestId !== activeRequestId) {
                return;
            }

            renderProductList(listContainer, products);
            toggleEmptyState(emptyState, !products.length);
            setStatus(status, products.length ? "内容已更新" : "暂无相关内容");
        } catch (error) {
            console.warn("Failed to load product content:", error);

            if (requestId !== activeRequestId) {
                return;
            }

            const products = filterFallbackProducts(fallbackProducts, tab);
            renderProductList(listContainer, products);
            toggleEmptyState(emptyState, !products.length);
            setStatus(status, products.length ? "接口异常，已展示静态内容" : "暂无相关内容");
        } finally {
            if (requestId === activeRequestId) {
                setListLoading(listContainer, false);
            }
        }
    };

    try {
        const requestedTabs = await fetchProductsTabs(apiConfig);

        if (requestedTabs.length) {
            tabs = ensureAllTab(requestedTabs);
            activeTab = resolveActiveTab(tabs, activeTab);
        }
    } catch (error) {
        console.warn("Failed to load product tabs:", error);
    }

    updateTabs(tabs, activeTab);
    await loadProductsByTab(activeTab);
}

function getProductsApiConfig(section) {
    const pageConfig = cleanObject({
        tabsUrl: section.getAttribute("data-tabs-url"),
        listUrl: section.getAttribute("data-list-url"),
        tabIdParam: section.getAttribute("data-tab-id-param"),
        tabSlugParam: section.getAttribute("data-tab-slug-param"),
        tabNameParam: section.getAttribute("data-tab-name-param"),
    });

    return Object.assign({}, DEFAULT_PRODUCTS_API_CONFIG, window.PRODUCTS_API_CONFIG || {}, pageConfig);
}

function fetchProductsTabs(apiConfig) {
    const requestOptions = buildApiRequestOptions(apiConfig.tabsMethod, apiConfig.tabsParams);

    return requestApi(apiConfig.tabsUrl, {}).then(function (response) {
        return ensureAllTab(
            extractArray(response)
                .map(function (item, index) {
                    return normalizeTabItem(item, index);
                })
                .filter(Boolean)
        );
    });
}

function fetchProductsContent(apiConfig, activeTab) {
    const params = Object.assign({}, apiConfig.listParams || {});
    const requestOptions = buildApiRequestOptions(apiConfig.listMethod, params);

    if (apiConfig.pageSizeParam && apiConfig.pageSize) {
        requestOptions.params[apiConfig.pageSizeParam] = apiConfig.pageSize;
    }

    if (activeTab && !activeTab.isAll) {
        if (apiConfig.tabIdParam && activeTab.id) {
            requestOptions.params[apiConfig.tabIdParam] = activeTab.id;
        }

        if (apiConfig.tabSlugParam && activeTab.slug) {
            requestOptions.params[apiConfig.tabSlugParam] = activeTab.slug;
        }

        if (apiConfig.tabNameParam && activeTab.name) {
            requestOptions.params[apiConfig.tabNameParam] = activeTab.name;
        }
    }

    return requestApi(apiConfig.listUrl, requestOptions).then(function (response) {
        return extractArray(response)
            .map(function (item, index) {
                return normalizeProductItem(item, index);
            })
            .filter(Boolean);
    });
}

function buildApiRequestOptions(method, params) {
    return {
        method: (method || "GET").toUpperCase(),
        params: Object.assign({}, params || {}),
    };
}

function requestApi(url, options) {
    const requestOptions = Object.assign(
        {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        },
        options || {}
    );
    const params = Object.assign({}, requestOptions.params || {});
    const method = (requestOptions.method || "GET").toUpperCase();

    delete requestOptions.params;

    let requestUrl = url;

    if (method === "GET") {
        requestUrl = buildUrlWithParams(url, params);
    } else if (!requestOptions.body && Object.keys(params).length) {
        requestOptions.headers = Object.assign(
            {
                "Content-Type": "application/json",
            },
            requestOptions.headers || {}
        );
        requestOptions.body = JSON.stringify(params);
    }

    return fetch(requestUrl, requestOptions).then(function (response) {
        if (!response.ok) {
            throw new Error("Request failed with status " + response.status);
        }

        const contentType = response.headers.get("content-type") || "";

        if (contentType.indexOf("application/json") !== -1) {
            return response.json();
        }

        return response.text();
    });
}

function buildUrlWithParams(url, params) {
    const query = new URLSearchParams();

    Object.keys(params || {}).forEach(function (key) {
        const value = params[key];

        if (value === null || value === undefined || value === "") {
            return;
        }

        query.set(key, value);
    });

    if (!query.toString()) {
        return url;
    }

    return url + (url.indexOf("?") === -1 ? "?" : "&") + query.toString();
}

function collectFallbackTabs(container) {
    return Array.from(container.querySelectorAll("[data-tab-id], .products-filter__tab"))
        .map(function (element, index) {
            const name = getText(element);

            return normalizeTabItem(
                {
                    id: element.getAttribute("data-tab-id") || element.id || "tab-" + index,
                    slug: element.getAttribute("data-tab-slug"),
                    name: element.getAttribute("data-tab-name") || name,
                    active:
                        element.classList.contains("is-active") ||
                        element.getAttribute("aria-selected") === "true",
                },
                index
            );
        })
        .filter(Boolean);
}

function collectFallbackProducts(container) {
    return Array.from(container.querySelectorAll("[data-product-item]"))
        .map(function (element, index) {
            return normalizeProductItem(
                {
                    id: element.getAttribute("data-product-id") || String(index + 1),
                    group: element.getAttribute("data-product-group") || element.getAttribute("data-product-groups"),
                    tag: element.getAttribute("data-product-tag") || getText(element.querySelector(".products-card__tag")),
                    title: element.getAttribute("data-product-title") || getText(element.querySelector(".products-card__title")),
                    description:
                        element.getAttribute("data-product-description") ||
                        getText(element.querySelector(".products-card__desc")),
                    imageUrl:
                        element.getAttribute("data-product-image") ||
                        (element.querySelector(".products-card__image")
                            ? element.querySelector(".products-card__image").getAttribute("src")
                            : ""),
                    detailUrl:
                        element.getAttribute("data-product-url") ||
                        (element.querySelector(".products-card__link")
                            ? element.querySelector(".products-card__link").getAttribute("href")
                            : ""),
                },
                index
            );
        })
        .filter(Boolean);
}

function renderTabs(container, tabs, activeTab, onTabSelect) {
    const activeId = activeTab ? activeTab.id : "";

    container.innerHTML = "";

    tabs.forEach(function (tab, index) {
        const button = document.createElement("button");
        const isActive = tab.id === activeId;

        button.type = "button";
        button.className = "products-filter__tab" + (isActive ? " is-active" : "");
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(isActive));
        button.setAttribute("tabindex", isActive ? "0" : "-1");
        button.dataset.tabId = tab.id;
        button.dataset.tabSlug = tab.slug;
        button.dataset.tabName = tab.name;
        button.textContent = tab.name;

        button.addEventListener("click", function () {
            onTabSelect(tab);
        });

        button.addEventListener("keydown", function (event) {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
            }

            event.preventDefault();

            const nextIndex = event.key === "ArrowRight" ? index + 1 : index - 1;
            const nextTab = tabs[(nextIndex + tabs.length) % tabs.length];
            const nextButton = container.children[(nextIndex + tabs.length) % tabs.length];

            if (nextButton) {
                nextButton.focus();
            }

            onTabSelect(nextTab);
        });

        container.appendChild(button);
    });
}

function renderProductList(container, products) {
    container.innerHTML = "";

    products.forEach(function (product) {
        container.appendChild(createProductCard(product));
    });
}

function createProductCard(product) {
    const article = document.createElement("article");
    const link = document.createElement("a");
    const panel = document.createElement("div");
    const image = document.createElement("img");
    const body = document.createElement("div");
    const tag = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");

    article.className = "products-card";
    article.dataset.productItem = "true";
    article.dataset.productId = product.id || "";
    article.dataset.productGroup = (product.groupValues || []).join(",");
    article.dataset.productTag = product.tag || "";
    article.dataset.productTitle = product.title || "";
    article.dataset.productDescription = product.description || "";
    article.dataset.productImage = product.imageUrl || "";
    article.dataset.productUrl = product.detailUrl || "";

    link.className = "products-card__link";
    link.href = product.detailUrl || "#";

    panel.className = "products-card__panel hover-card";
    image.className = "products-card__image";
    image.src = product.imageUrl || "/assets/images/1.jpg";
    image.alt = (product.title || "案例") + "封面";
    body.className = "products-card__body";
    tag.className = "products-card__tag";
    title.className = "products-card__title";
    description.className = "products-card__desc";

    tag.textContent = product.tag || "成功案例";
    title.textContent = product.title || "未命名案例";
    description.textContent = product.description || "暂无案例简介";

    body.appendChild(tag);
    body.appendChild(title);
    body.appendChild(description);
    panel.appendChild(image);
    panel.appendChild(body);
    link.appendChild(panel);
    article.appendChild(link);

    return article;
}

function normalizeTabItem(item, index) {
    if (!item) {
        return null;
    }

    if (typeof item === "string") {
        item = {
            name: item,
        };
    }

    const name = pickFirstValue(item.name, item.tabName, item.categoryName, item.label, item.title, item.text);
    const id = String(
        pickFirstValue(item.id, item.tabId, item.categoryId, item.value, item.code, item.key, item.slug, name, "tab-" + index)
    ).trim();
    const slug = String(pickFirstValue(item.slug, item.code, item.key, item.value, id)).trim();
    const isAll = Boolean(item.isAll || normalizeComparable(id) === "all" || normalizeComparable(slug) === "all" || name === "全部");

    if (!name) {
        return null;
    }

    return {
        id: isAll ? "all" : id,
        slug: isAll ? "all" : slug,
        name: name,
        isAll: isAll,
        active: Boolean(item.active || item.selected || item.default || item.checked),
    };
}

function normalizeProductItem(item, index) {
    if (!item || typeof item !== "object") {
        return null;
    }

    const id = String(pickFirstValue(item.id, item.productId, item.caseId, item.idStr, index + 1)).trim();
    const title = pickFirstValue(item.title, item.name, item.productName, item.caseName, item.projectName);
    const description = pickFirstValue(
        item.description,
        item.desc,
        item.summary,
        item.introduction,
        item.customerBackground,
        item.content
    );

    if (!title) {
        return null;
    }

    return {
        id: id,
        title: title,
        tag: pickFirstValue(item.tag, item.category, item.categoryName, item.type, item.industry, "成功案例"),
        description: description || "暂无案例简介",
        imageUrl: pickFirstValue(item.imageUrl, item.cover, item.image, item.banner, item.thumbnail, "/assets/images/1.jpg"),
        detailUrl:
            pickFirstValue(item.detailUrl, item.url, item.href, item.link) ||
            "/products/detail/?id=" + encodeURIComponent(id),
        groupValues: splitGroupValues(
            pickFirstValue(
                item.group,
                item.groups,
                item.tab,
                item.tabKey,
                item.tabSlug,
                item.categoryId,
                item.categoryCode,
                item.categoryName,
                item.type
            )
        ),
    };
}

function filterFallbackProducts(products, activeTab) {
    return products.filter(function (product) {
        return matchesTab(product, activeTab);
    });
}

function matchesTab(product, activeTab) {
    if (!activeTab || activeTab.isAll) {
        return true;
    }

    const targets = [activeTab.id, activeTab.slug, activeTab.name]
        .map(normalizeComparable)
        .filter(Boolean);
    const sources = []
        .concat(product.groupValues || [])
        .concat(product.tag || [])
        .map(normalizeComparable)
        .filter(Boolean);

    if (!targets.length) {
        return true;
    }

    return targets.some(function (target) {
        return sources.indexOf(target) !== -1;
    });
}

function toggleEmptyState(emptyState, isEmpty) {
    if (!emptyState) {
        return;
    }

    emptyState.hidden = !isEmpty;
}

function setListLoading(container, isLoading) {
    container.classList.toggle("is-loading", isLoading);
    container.setAttribute("aria-busy", String(isLoading));
}

function setStatus(statusElement, message) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message || "";
}

function resolveActiveTab(tabs, currentActiveTab) {
    if (!tabs.length) {
        return createDefaultAllTab();
    }

    if (currentActiveTab) {
        const matchedTab = tabs.find(function (tab) {
            return isSameTab(tab, currentActiveTab);
        });

        if (matchedTab) {
            return matchedTab;
        }
    }

    return getInitialActiveTab(tabs);
}

function getInitialActiveTab(tabs) {
    return tabs.find(function (tab) {
        return tab.active;
    }) || tabs[0] || createDefaultAllTab();
}

function ensureAllTab(tabs) {
    const dedupedTabs = [];
    const usedKeys = {};

    tabs.forEach(function (tab) {
        const normalizedTab = normalizeTabItem(tab, dedupedTabs.length);

        if (!normalizedTab) {
            return;
        }

        const identity = normalizeComparable(normalizedTab.id || normalizedTab.slug || normalizedTab.name);

        if (!identity || usedKeys[identity]) {
            return;
        }

        usedKeys[identity] = true;
        dedupedTabs.push(normalizedTab);
    });

    const hasAllTab = dedupedTabs.some(function (tab) {
        return tab.isAll;
    });

    if (!hasAllTab) {
        dedupedTabs.unshift(createDefaultAllTab());
    } else {
        dedupedTabs.sort(function (left, right) {
            if (left.isAll) {
                return -1;
            }

            if (right.isAll) {
                return 1;
            }

            return 0;
        });
    }

    return dedupedTabs;
}

function createDefaultAllTab() {
    return {
        id: "all",
        slug: "all",
        name: "全部",
        isAll: true,
        active: true,
    };
}

function extractArray(response) {
    const candidates = [
        response,
        response && response.data,
        response && response.result,
        response && response.list,
        response && response.rows,
        response && response.records,
        response && response.items,
        response && response.tabs,
        response && response.categories,
        response && response.data && response.data.list,
        response && response.data && response.data.rows,
        response && response.data && response.data.records,
        response && response.data && response.data.items,
        response && response.data && response.data.tabs,
        response && response.data && response.data.categories,
        response && response.result && response.result.list,
        response && response.result && response.result.rows,
        response && response.result && response.result.records,
        response && response.result && response.result.items,
    ];

    for (let index = 0; index < candidates.length; index += 1) {
        if (Array.isArray(candidates[index])) {
            return candidates[index];
        }
    }

    return [];
}

function splitGroupValues(value) {
    if (Array.isArray(value)) {
        return value
            .map(function (item) {
                return String(item).trim();
            })
            .filter(Boolean);
    }

    if (value === null || value === undefined || value === "") {
        return [];
    }

    return String(value)
        .split(/[,\|/，]/)
        .map(function (item) {
            return item.trim();
        })
        .filter(Boolean);
}

function pickFirstValue() {
    for (let index = 0; index < arguments.length; index += 1) {
        const value = arguments[index];

        if (value === null || value === undefined) {
            continue;
        }

        if (typeof value === "string" && !value.trim()) {
            continue;
        }

        return value;
    }

    return "";
}

function cleanObject(source) {
    const target = {};

    Object.keys(source || {}).forEach(function (key) {
        if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
            target[key] = source[key];
        }
    });

    return target;
}

function normalizeComparable(value) {
    return String(value || "").trim().toLowerCase();
}

function isSameTab(left, right) {
    if (!left || !right) {
        return false;
    }

    return (
        normalizeComparable(left.id) === normalizeComparable(right.id) ||
        normalizeComparable(left.slug) === normalizeComparable(right.slug) ||
        normalizeComparable(left.name) === normalizeComparable(right.name)
    );
}

function getText(element) {
    return element ? (element.textContent || "").trim() : "";
}

function debounce(callback, wait) {
    let timer = null;

    return function () {
        const args = arguments;
        const context = this;

        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
            callback.apply(context, args);
        }, wait);
    };
}
