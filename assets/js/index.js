document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    void initCasesCarousel();
    initLeadForm();
    initFloatingContact();
});

const CASES_API_URL = window.CASES_API_URL || "/api/projectCase/list";

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

async function initCasesCarousel() {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverQuery = window.matchMedia("(hover: hover)");
    const requestedCases = await fetchCasesData();
    const carousels = document.querySelectorAll(".cases-carousel");

    for (const carousel of carousels) {
        const track = carousel.querySelector(".carousel-track-inner");
        const prevBtn = carousel.querySelector("[data-carousel-prev]");
        const nextBtn = carousel.querySelector("[data-carousel-next]");
        const section = carousel.closest("section");
        const dotsContainer = section ? section.querySelector("[data-carousel-dots]") : null;

        if (!track || !prevBtn || !nextBtn) {
            continue; // 原来的 return 改成 continue
        }

        const fallbackCases = collectCaseItems(track);
        const caseData = requestedCases.length ? requestedCases : fallbackCases;

        if (!caseData.length) {
            continue; // 原来的 return 改成 continue
        }

        // ✅ 最核心的修复：等待网络请求和 DOM 渲染彻底完成
        await renderCaseItems(track, caseData);

        const baseItems = Array.from(track.children);
        const hasMultipleItems = baseItems.length > 1;
        let items = baseItems.slice();
        let autoplayTimer = null;
        let dotButtons = [];
        let currentPage = hasMultipleItems ? 1 : 0;
        let isAnimating = false;

        if (hasMultipleItems) {
            const firstClone = baseItems[0].cloneNode(true);
            const lastClone = baseItems[baseItems.length - 1].cloneNode(true);

            firstClone.setAttribute("data-carousel-clone", "true");
            firstClone.setAttribute("aria-hidden", "true");
            lastClone.setAttribute("data-carousel-clone", "true");
            lastClone.setAttribute("aria-hidden", "true");

            track.insertBefore(lastClone, track.firstChild);
            track.appendChild(firstClone);
            items = Array.from(track.children);
        }

        const getPageCount = function () {
            return hasMultipleItems ? items.length - 2 : items.length;
        };

        const getRealPageIndex = function () {
            if (!hasMultipleItems) {
                return 0;
            }

            return (currentPage - 1 + getPageCount()) % getPageCount();
        };

        const shouldAutoplay = function () {
            return window.innerWidth > 900 && !reducedMotionQuery.matches && getPageCount() > 1;
        };

        const updateCarousel = function (shouldAnimate) {
            const currentItem = items[currentPage];

            if (!currentItem) {
                return;
            }

            const itemWidth = currentItem.getBoundingClientRect().width;
            const itemOffset = currentItem.offsetLeft;
            const offset = Math.max(0, itemOffset - (carousel.clientWidth - itemWidth) / 2);

            isAnimating = shouldAnimate !== false && hasMultipleItems;
            track.classList.toggle("is-resetting", shouldAnimate === false);
            track.style.transform = "translateX(-" + offset + "px)";

            const disabled = getPageCount() <= 1;
            prevBtn.disabled = disabled;
            nextBtn.disabled = disabled;

            dotButtons.forEach(function (dot, index) {
                dot.classList.toggle("active", index === getRealPageIndex());
            });
        };

        const goToPage = function (nextPage) {
            const pageCount = getPageCount();

            if (pageCount <= 1) {
                currentPage = 0;
                updateCarousel(false);
                return;
            }

            if (isAnimating) {
                return;
            }

            currentPage = nextPage;
            updateCarousel(true);
        };

        const stopAutoplay = function () {
            if (autoplayTimer) {
                window.clearInterval(autoplayTimer);
                autoplayTimer = null;
            }
        };

        const startAutoplay = function () {
            stopAutoplay();

            if (!shouldAutoplay()) {
                return;
            }

            autoplayTimer = window.setInterval(function () {
                goToPage(currentPage + 1);
            }, 5000);
        };

        const renderDots = function () {
            if (!dotsContainer) {
                return;
            }

            const count = getPageCount();
            dotsContainer.innerHTML = "";
            dotsContainer.style.display = count <= 1 ? "none" : "flex";
            dotButtons = [];

            for (let index = 0; index < count; index += 1) {
                const dot = document.createElement("button");
                dot.type = "button";
                dot.className = "carousel-dot";
                dot.setAttribute("aria-label", "切换到第 " + (index + 1) + " 组案例");
                dot.addEventListener("click", function () {
                    goToPage(hasMultipleItems ? index + 1 : index);
                    startAutoplay();
                });
                dotsContainer.appendChild(dot);
                dotButtons.push(dot);
            }
        };

        track.addEventListener("transitionend", function (event) {
            if (event.target !== track || event.propertyName !== "transform" || !hasMultipleItems) {
                return;
            }

            isAnimating = false;

            if (currentPage === 0) {
                currentPage = getPageCount();
                updateCarousel(false);
                requestAnimationFrame(function () {
                    track.classList.remove("is-resetting");
                });
                return;
            }

            if (currentPage === getPageCount() + 1) {
                currentPage = 1;
                updateCarousel(false);
                requestAnimationFrame(function () {
                    track.classList.remove("is-resetting");
                });
                return;
            }

            track.classList.remove("is-resetting");
        });

        prevBtn.addEventListener("click", function () {
            goToPage(currentPage - 1);
            startAutoplay();
        });

        nextBtn.addEventListener("click", function () {
            goToPage(currentPage + 1);
            startAutoplay();
        });

        if (hoverQuery.matches) {
            carousel.addEventListener("mouseenter", stopAutoplay);
            carousel.addEventListener("mouseleave", startAutoplay);
        }

        window.addEventListener(
            "resize",
            debounce(function () {
                updateCarousel(false);
                requestAnimationFrame(function () {
                    track.classList.remove("is-resetting");
                });
                startAutoplay();
            }, 120),
            { passive: true }
        );

        renderDots();
        updateCarousel(false);
        requestAnimationFrame(function () {
            track.classList.remove("is-resetting");
        });
        startAutoplay();
    }
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

    if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
        requestOptions.headers = Object.assign(
            {
                "Content-Type": "application/json",
            },
            requestOptions.headers || {}
        );

        if (typeof requestOptions.body !== "string") {
            requestOptions.body = JSON.stringify(requestOptions.body);
        }
    }

    return fetch(url, requestOptions).then(function (response) {
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

function fetchCasesData() {
    return requestApi(CASES_API_URL)
        .then(function (response) {
            return extractCaseList(response)
                .map(function (item, index) {
                    return normalizeCaseItem(item, index);
                })
                .filter(Boolean);
        })
        .catch(function (error) {
            console.warn("Failed to load cases data:", error);
            return [];
        });
}

function extractCaseList(response) {
    const candidates = response.data || [];
    return candidates
}

function normalizeCaseItem(item, index) {

    if (!item || typeof item !== "object") {
        return null;
    }
    return {
        category: item.industry || "成功案例",
        title: item.projectName || "案例标题",
        description: item.customerBackground || item.desc || item.summary || item.content || "",
        metrics: normalizeCaseMetrics(item),
        detailUrl:  "/products/detail/?id=" + item.recordId,
        detailText: item.detailText || item.buttonText || "查看案例详情",
        imageUrl: item.titleBackgroundImage[0].fileToken,
        imageClassName: item.imageClassName || item.imageClass || getDefaultCaseImageClass(index),
    };
}

function normalizeCaseMetrics(item) {
    return [{ value: item.metric1 * 100 + '%', label: item.metric1Label }, { value: item.metric2 * 100 + 'min', label: item.metric2Label }, { value: item.metric3 * 100 + '%', label: item.metric3Label }];
}

function isValidCaseMetric(metric) {
    return Boolean(metric && String(metric.value || "").trim() && String(metric.label || "").trim());
}

function collectCaseItems(track) {
    return Array.from(track ? track.children : [])
        .map(function (item, index) {
            const article = item.querySelector(".case-article-card");
            const detailLink = item.querySelector(".btn-case-detail");

            if (!article) {
                return null;
            }

            const imageClassName = Array.from(article.classList).find(function (className) {
                return className.indexOf("case-image-") === 0;
            });

            return {
                category: getText(item.querySelector(".case-category-tag")),
                title: getText(item.querySelector(".case-title")),
                description: getText(item.querySelector(".case-description")),
                metrics: Array.from(item.querySelectorAll(".case-metrics-list li"))
                    .map(function (metricItem) {
                        return {
                            value: getText(metricItem.querySelector(".metric-value")),
                            label: getText(metricItem.querySelector(".metric-label")),
                        };
                    })
                    .filter(isValidCaseMetric),
                detailUrl: detailLink ? detailLink.getAttribute("href") || "#" : "#",
                detailText: getText(detailLink) || "查看案例详情",
                imageUrl: readBackgroundImage(article),
                imageClassName: imageClassName || getDefaultCaseImageClass(index),
            };
        })
        .filter(Boolean);
}

async function renderCaseItems(track, cases) {
    track.innerHTML = "";

    const fileIds = cases
        .map(item => item.imageUrl)
        .filter(url => url && !url.startsWith("http") && !url.startsWith("url(") && !url.startsWith("data:"));

    let urlMap = {};
    console.log(fileIds)
    if (fileIds.length > 0) {
        try {
            const res = await requestApi('/api/file/getFileTmpUrl?fileIds=' + fileIds.join(','));

            const urlList = res.data || res;

            fileIds.forEach((id, index) => {
                urlMap[id] = urlList[index]?.tmpDownloadUrl || urlList[index];
            });
        } catch (e) {
            console.error("批量图片链接获取失败:", e);
        }
    }

    // 3. 使用 DocumentFragment 优化渲染性能
    const fragment = document.createDocumentFragment();

    cases.forEach(function (caseItem, index) {
        caseItem.imageUrl = urlMap[caseItem.imageUrl] || caseItem.imageUrl;
        fragment.appendChild(createCaseItemElement(caseItem, index));
    });

    track.appendChild(fragment);
}

function createCaseItemElement(caseItem, index) {
    const wrapper = document.createElement("div");
    const article = document.createElement("article");
    const category = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const metricsList = document.createElement("ul");
    const actionWrap = document.createElement("div");
    const detailLink = document.createElement("a");

    wrapper.className = "case-items-wrapper";
    article.className = "case-article-card " + (caseItem.imageClassName || getDefaultCaseImageClass(index));
    category.className = "case-category-tag";
    title.className = "case-title";
    description.className = "case-description";
    metricsList.className = "case-metrics-list";
    actionWrap.className = "case-action-wrap";
    detailLink.className = "btn-case-detail";
    detailLink.href = caseItem.detailUrl || "#";
    detailLink.target = "_blank";
    category.textContent = caseItem.category;
    title.textContent = caseItem.title;
    description.textContent = caseItem.description;
    detailLink.textContent = caseItem.detailText || "查看案例详情";

    if (caseItem.imageUrl) {
        article.style.backgroundImage = 'url("' + caseItem.imageUrl.replace(/"/g, '\\"') + '")';
    }

    caseItem.metrics.forEach(function (metric) {
        const metricItem = document.createElement("li");
        const metricValue = document.createElement("div");
        const metricLabel = document.createElement("div");

        metricValue.className = "metric-value";
        metricLabel.className = "metric-label";
        metricValue.textContent = metric.value;
        metricLabel.textContent = metric.label;

        metricItem.appendChild(metricValue);
        metricItem.appendChild(metricLabel);
        metricsList.appendChild(metricItem);
    });

    actionWrap.appendChild(detailLink);
    article.appendChild(category);
    article.appendChild(title);
    article.appendChild(description);
    article.appendChild(metricsList);
    article.appendChild(actionWrap);
    wrapper.appendChild(article);

    return wrapper;
}

function getDefaultCaseImageClass(index) {
    const classes = ["case-image-2", "case-image-3", "case-image-4"];
    return classes[index % classes.length];
}

function getText(element) {
    return element ? (element.textContent || "").trim() : "";
}

function readBackgroundImage(element) {
    if (!element) {
        return "";
    }

    const inlineBackground = element.style.backgroundImage || "";
    const computedBackground = window.getComputedStyle(element).backgroundImage || "";
    const backgroundImage = inlineBackground && inlineBackground !== "none" ? inlineBackground : computedBackground;
    const matched = backgroundImage.match(/url\(["']?(.*?)["']?\)/);

    return matched ? matched[1] : "";
}

function initLeadForm() {
    document.querySelectorAll(".lead-gen-form").forEach(function (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
        });
    });
}

function initFloatingContact() {
    const widget = document.querySelector("[data-floating-contact]");

    if (!widget) {
        return;
    }

    const trigger = widget.querySelector(".floating-contact-trigger");
    const panel = widget.querySelector(".floating-contact-panel");
    const hoverQuery = window.matchMedia("(hover: hover)");
    const CLOSE_DELAY = 180;
    let closeTimer = null;

    if (!trigger || !panel) {
        return;
    }

    const clearCloseTimer = function () {
        if (closeTimer) {
            window.clearTimeout(closeTimer);
            closeTimer = null;
        }
    };

    const setOpen = function (isOpen) {
        clearCloseTimer();
        widget.classList.toggle("is-open", isOpen);
        trigger.setAttribute("aria-expanded", String(isOpen));
        trigger.setAttribute("aria-label", isOpen ? "收起联系我们面板" : "展开联系我们面板");
        panel.hidden = !isOpen;
    };

    const closePanel = function () {
        clearCloseTimer();
        setOpen(false);
    };

    const scheduleClose = function () {
        clearCloseTimer();
        closeTimer = window.setTimeout(function () {
            const activeElement = document.activeElement;
            const keepOpen =
                widget.matches(":hover") ||
                panel.matches(":hover") ||
                trigger.matches(":hover") ||
                (activeElement && widget.contains(activeElement));

            if (!keepOpen) {
                setOpen(false);
            }
        }, CLOSE_DELAY);
    };

    if (hoverQuery.matches) {
        trigger.addEventListener("mouseenter", function () {
            setOpen(true);
        });

        trigger.addEventListener("mouseleave", function (event) {
            if (panel.contains(event.relatedTarget)) {
                return;
            }

            scheduleClose();
        });

        panel.addEventListener("mouseenter", function () {
            clearCloseTimer();
            setOpen(true);
        });

        panel.addEventListener("mouseleave", function (event) {
            if (trigger.contains(event.relatedTarget)) {
                return;
            }

            scheduleClose();
        });
    }

    trigger.addEventListener("click", function () {
        if (hoverQuery.matches) {
            setOpen(true);
            return;
        }

        setOpen(!widget.classList.contains("is-open"));
    });

    widget.addEventListener("focusin", function () {
        setOpen(true);
    });

    widget.addEventListener("focusout", function (event) {
        if (!widget.contains(event.relatedTarget)) {
            scheduleClose();
        }
    });

    document.addEventListener("click", function (event) {
        if (!widget.contains(event.target)) {
            closePanel();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closePanel();
        }
    });

    setOpen(false);
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
