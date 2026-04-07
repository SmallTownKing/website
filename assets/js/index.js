document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    void initCasesCarousel();
    initLeadForm();
    initFloatingContact();
    const contactBtn = document.getElementById('online-contact-btn');
    if (contactBtn) {
        contactBtn.addEventListener('click', function () {

            window.open('https://work.weixin.qq.com/kfid/kfc6682a6f30bc8a16f', '_blank');

        });
    }
    const modal = document.getElementById('solutionModal');
    const form = document.getElementById('solutionForm');
    const submitBtn = document.getElementById('submitBtn');
    const modal1 = document.getElementById('successModal');
    window.openSuccessModal = function () {
        modal1.classList.add('is-active');
        document.body.style.overflow = 'hidden';
    }
    window.closeSuccessModal = function () {
        modal1.classList.remove('is-active');
        document.body.style.overflow = '';
    }
    window.openSolutionModal = function () {
        modal.classList.add('is-active');
        document.body.style.overflow = 'hidden';
    }



    window.closeSolutionModal = function () {
        modal.classList.remove('is-active');
        document.body.style.overflow = '';
        setTimeout(() => {
            form.reset();
        }, 300);
    }
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const nameValue = document.getElementById('userName').value.trim();
        const phoneValue = document.getElementById('userPhone').value.trim();
        const messageValue = document.getElementById('userMessage').value.trim();
        const phoneReg = /^1[3-9]\d{9}$/;
        if (!phoneReg.test(phoneValue)) {
            alert("请输入正确的11位手机号码！");
            return;
        }
        const submitData = {
            companyFullName: nameValue,
            phoneNumber: phoneValue,
            problemDescription: messageValue
        };
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '提交中...';
        submitBtn.disabled = true;

        requestApi("/api/mql/add", {
            method: "POST",
            body: submitData
        })
            .then(function (response) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                closeSolutionModal();
                openSuccessModal();
            })
            .catch(function (error) {
                console.error("提交失败:", error);
                alert("提交失败，请稍后再试。");
            })
            .finally(function () { })
    });

});

const CASES_API_URL = window.CASES_API_URL || "/api/projectCase/list";
const CASES_SKELETON_COUNT = 3;
const CASES_SWIPE_THRESHOLD = 48;

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
    const carousels = document.querySelectorAll(".cases-carousel");

    if (!carousels.length) {
        return;
    }

    const requestedCasesPromise = prepareCasesForRender();

    for (const carousel of carousels) {
        const section = carousel.closest("section");
        const track = carousel.querySelector(".carousel-track-inner");
        const prevBtn = section ? section.querySelector("[data-carousel-prev]") : null;
        const nextBtn = section ? section.querySelector("[data-carousel-next]") : null;

        if (!track || !prevBtn || !nextBtn) {
            continue;
        }

        renderCaseSkeletonItems(track, CASES_SKELETON_COUNT);
        track.setAttribute("aria-busy", "true");
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        const skeletonItems = Array.from(track.children);
        const skeletonActiveIndex = skeletonItems.length > 1 ? 1 : 0;
        centerCaseTrack(carousel, track, skeletonItems, skeletonActiveIndex, false);
        requestAnimationFrame(function () {
            track.classList.remove("is-resetting");
        });

        const caseData = await requestedCasesPromise;

        if (!caseData.length) {
            track.setAttribute("aria-busy", "false");
            continue;
        }

        renderCaseItems(track, caseData);
        track.setAttribute("aria-busy", "false");

        const baseItems = Array.from(track.children);
        const pageCount = baseItems.length;
        const hasMultipleItems = pageCount > 1;
        let items = baseItems.slice();
        let autoplayTimer = null;
        let currentPage = hasMultipleItems ? pageCount : 0;
        let isAnimating = false;
        let touchStartX = 0;
        let touchStartY = 0;
        let touchDeltaX = 0;
        let touchDeltaY = 0;
        let isTouchTracking = false;
        const loopStartIndex = hasMultipleItems ? pageCount : 0;
        const loopEndIndex = hasMultipleItems ? pageCount * 2 - 1 : 0;

        if (hasMultipleItems) {
            const leadingClones = document.createDocumentFragment();
            const trailingClones = document.createDocumentFragment();

            baseItems.forEach(function (item) {
                const leadingClone = item.cloneNode(true);
                const trailingClone = item.cloneNode(true);

                leadingClone.setAttribute("data-carousel-clone", "true");
                leadingClone.setAttribute("aria-hidden", "true");
                trailingClone.setAttribute("data-carousel-clone", "true");
                trailingClone.setAttribute("aria-hidden", "true");

                leadingClones.appendChild(leadingClone);
                trailingClones.appendChild(trailingClone);
            });

            track.insertBefore(leadingClones, track.firstChild);
            track.appendChild(trailingClones);
            items = Array.from(track.children);
        }

        const getPageCount = function () {
            return pageCount;
        };

        const shouldAutoplay = function () {
            return window.innerWidth > 900 && !reducedMotionQuery.matches && getPageCount() > 1;
        };

        const updateCarousel = function (shouldAnimate) {
            isAnimating = shouldAnimate !== false && hasMultipleItems;
            centerCaseTrack(carousel, track, items, currentPage, shouldAnimate);

            const disabled = getPageCount() <= 1;
            prevBtn.disabled = disabled;
            nextBtn.disabled = disabled;
        };

        const finishInstantReset = function () {
            requestAnimationFrame(function () {
                track.style.transition = "";
                track.classList.remove("is-resetting");
            });
        };

        const jumpToPage = function (nextPage) {
            currentPage = nextPage;
            updateCarousel(false);
            finishInstantReset();
        };

        const goToPage = function (nextPage) {
            const visiblePageCount = getPageCount();

            if (visiblePageCount <= 1) {
                currentPage = 0;
                updateCarousel(false);
                finishInstantReset();
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

        const resetTouchTracking = function () {
            touchStartX = 0;
            touchStartY = 0;
            touchDeltaX = 0;
            touchDeltaY = 0;
            isTouchTracking = false;
        };

        track.addEventListener("transitionend", function (event) {
            if (event.target !== track || event.propertyName !== "transform" || !hasMultipleItems) {
                return;
            }

            isAnimating = false;

            if (currentPage < loopStartIndex) {
                jumpToPage(currentPage + pageCount);
                return;
            }

            if (currentPage > loopEndIndex) {
                jumpToPage(currentPage - pageCount);
                return;
            }

            track.style.transition = "";
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

        carousel.addEventListener(
            "touchstart",
            function (event) {
                if (getPageCount() <= 1 || !event.touches.length) {
                    return;
                }

                const touch = event.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                touchDeltaX = 0;
                touchDeltaY = 0;
                isTouchTracking = true;
                stopAutoplay();
            },
            { passive: true }
        );

        carousel.addEventListener(
            "touchmove",
            function (event) {
                if (!isTouchTracking || !event.touches.length) {
                    return;
                }

                const touch = event.touches[0];
                touchDeltaX = touch.clientX - touchStartX;
                touchDeltaY = touch.clientY - touchStartY;
            },
            { passive: true }
        );

        carousel.addEventListener(
            "touchend",
            function () {
                if (!isTouchTracking) {
                    return;
                }

                if (Math.abs(touchDeltaX) > CASES_SWIPE_THRESHOLD && Math.abs(touchDeltaX) > Math.abs(touchDeltaY)) {
                    goToPage(currentPage + (touchDeltaX < 0 ? 1 : -1));
                }

                resetTouchTracking();
                startAutoplay();
            },
            { passive: true }
        );

        carousel.addEventListener(
            "touchcancel",
            function () {
                resetTouchTracking();
                startAutoplay();
            },
            { passive: true }
        );

        window.addEventListener(
            "resize",
            debounce(function () {
                updateCarousel(false);
                finishInstantReset();
                startAutoplay();
            }, 120),
            { passive: true }
        );

        updateCarousel(false);
        finishInstantReset();
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

function prepareCasesForRender() {
    return fetchCasesData().then(function (cases) {
        if (!cases.length) {
            return [];
        }

        return hydrateCaseImages(cases).then(function (hydratedCases) {
            return preloadCaseImages(hydratedCases).then(function () {
                return hydratedCases;
            });
        });
    });
}

function extractCaseList(response) {
    const candidates = [
        response,
        response && response.data,
        response && response.result,
        response && response.list,
        response && response.rows,
        response && response.records,
        response && response.data && response.data.list,
        response && response.data && response.data.rows,
        response && response.data && response.data.records,
        response && response.result && response.result.list,
        response && response.result && response.result.rows,
        response && response.result && response.result.records,
    ];

    for (let index = 0; index < candidates.length; index += 1) {
        if (Array.isArray(candidates[index])) {
            return candidates[index];
        }
    }

    return [];
}

function normalizeCaseItem(item, index) {
    if (!item || typeof item !== "object") {
        return null;
    }

    const titleBackgroundImage = Array.isArray(item.titleBackgroundImage) ? item.titleBackgroundImage : [];
    const firstBackgroundImage = titleBackgroundImage[0] || {};
    const recordId = item.recordId || item.id || index + 1;

    return {
        category: item.industry || item.category || "成功案例",
        title: item.projectName || item.title || "案例标题",
        description: item.customerBackground || item.desc || item.summary || item.content || "",
        metrics: normalizeCaseMetrics(item),
        detailUrl: item.detailUrl || item.url || item.href || item.link || "/products/detail/?id=" + encodeURIComponent(recordId),
        detailText: item.detailText || item.buttonText || "查看案例详情",
        imageUrl: item.imageUrl || item.image || item.cover || item.background || item.banner || firstBackgroundImage.fileToken || "",
        imageClassName: item.imageClassName || item.imageClass || getDefaultCaseImageClass(index),
    };
}

function normalizeCaseMetrics(item) {
    return [{ value: item.metric1 * 100 + '%', label: item.metric1Label }, { value: item.metric2 * 100 + 'min', label: item.metric2Label }, { value: item.metric3 * 100 + '%', label: item.metric3Label }];
}

function isValidCaseMetric(metric) {
    return Boolean(metric && String(metric.value || "").trim() && String(metric.label || "").trim());
}

function renderCaseItems(track, cases) {
    const fragment = document.createDocumentFragment();

    cases.forEach(function (caseItem, index) {
        fragment.appendChild(createCaseItemElement(caseItem, index));
    });

    track.replaceChildren(fragment);
}

function createCaseItemElement(caseItem, index) {
    const wrapper = document.createElement("a");
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
    wrapper.href = caseItem.detailUrl || "#";
    wrapper.target = "_blank";
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

function renderCaseSkeletonItems(track, count) {
    const fragment = document.createDocumentFragment();

    track.innerHTML = "";

    for (let index = 0; index < count; index += 1) {
        fragment.appendChild(createCaseSkeletonElement());
    }

    track.appendChild(fragment);
}

function hydrateCaseImages(cases) {
    const fileIds = Array.from(
        new Set(
            cases
                .map(function (item) {
                    return item.imageUrl;
                })
                .filter(function (url) {
                    return needsCaseImageResolution(url);
                })
        )
    );

    if (!fileIds.length) {
        return Promise.resolve(cases.slice());
    }

    return requestApi("/api/file/getFileTmpUrl?fileIds=" + fileIds.join(","))
        .then(function (response) {
            const urlMap = normalizeCaseImageUrlMap(response);

            return cases.map(function (caseItem) {
                return Object.assign({}, caseItem, {
                    imageUrl: urlMap[caseItem.imageUrl] || caseItem.imageUrl,
                });
            });
        })
        .catch(function (error) {
            console.error("批量图片链接获取失败:", error);
            return cases.slice();
        });
}

function normalizeCaseImageUrlMap(response) {
    const payload = response && (response.data || response.result || response);
    const map = {};

    if (Array.isArray(payload)) {
        payload.forEach(function (item) {
            if (typeof item === "string") {
                return;
            }

            if (!item || typeof item !== "object") {
                return;
            }

            const fileId = item.fileToken || item.fileId || item.id;
            const url = item.tmpDownloadUrl || item.url || item.fileUrl || item.tmpUrl;

            if (fileId && url) {
                map[fileId] = url;
            }
        });

        return map;
    }

    if (payload && typeof payload === "object") {
        Object.keys(payload).forEach(function (key) {
            const value = payload[key];
            const url =
                typeof value === "string"
                    ? value
                    : value && (value.tmpDownloadUrl || value.url || value.fileUrl || value.tmpUrl);

            if (url) {
                map[key] = url;
            }
        });
    }

    return map;
}

function preloadCaseImages(cases) {
    const imageUrls = Array.from(
        new Set(
            (cases || [])
                .map(function (item) {
                    return item.imageUrl;
                })
                .filter(Boolean)
        )
    );

    if (!imageUrls.length) {
        return Promise.resolve();
    }

    return Promise.allSettled(
        imageUrls.map(function (url) {
            return preloadSingleImage(url, 2200);
        })
    ).then(function () {
        return undefined;
    });
}

function preloadSingleImage(url, timeoutMs) {
    return new Promise(function (resolve) {
        const image = new Image();
        let resolved = false;
        const timer = window.setTimeout(done, timeoutMs || 2000);

        function done() {
            if (resolved) {
                return;
            }

            resolved = true;
            window.clearTimeout(timer);
            resolve();
        }

        image.onload = done;
        image.onerror = done;
        image.src = url;
    });
}

function needsCaseImageResolution(url) {
    const source = String(url || "").trim();

    if (!source) {
        return false;
    }

    return !/^(https?:)?\/\//.test(source) && !/^(data:|blob:|\/|\.)/.test(source);
}

function createCaseSkeletonElement() {
    const wrapper = document.createElement("div");
    const article = document.createElement("article");

    wrapper.className = "case-items-wrapper case-items-wrapper--skeleton";
    wrapper.setAttribute("data-carousel-skeleton", "true");

    article.className = "case-article-card case-article-card--skeleton";
    article.setAttribute("aria-hidden", "true");
    wrapper.appendChild(article);

    return wrapper;
}

function centerCaseTrack(carousel, track, items, currentPage, shouldAnimate) {
    const currentItem = items[currentPage];
    const isInstant = shouldAnimate === false;

    if (!currentItem) {
        return;
    }

    const itemWidth = currentItem.getBoundingClientRect().width;
    const itemOffset = currentItem.offsetLeft;
    const offset = Math.max(0, itemOffset - (carousel.clientWidth - itemWidth) / 2);

    if (isInstant) {
        track.classList.add("is-resetting");
        track.style.transition = "none";
    } else {
        track.style.transition = "";
        track.classList.remove("is-resetting");
    }

    track.style.transform = "translateX(-" + offset + "px)";

    if (isInstant) {
        track.getBoundingClientRect();
    }
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
        const submitButton = form.querySelector(".btn-submit");
        const textInput = form.querySelector('input[type="text"]');
        const phoneInput = form.querySelector('input[type="tel"]');

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const nameValue = textInput ? textInput.value.trim() : "";
            const phoneValue = phoneInput ? phoneInput.value.trim() : "";
            const phoneReg = /^1[3-9]\d{9}$/;

            if (!phoneReg.test(phoneValue)) {
                alert("请输入正确的11位手机号。");
                return;
            }

            if (submitButton) {
                submitButton.textContent = "提交中...";
                submitButton.disabled = true;
            }

            requestApi("/api/mql/add", {
                method: "POST",
                body: {
                    companyFullName: nameValue,
                    phoneNumber: phoneValue,
                },
            })
                .then(function () {
                    form.reset();
                    openSuccessModal();

                })
                .catch(function (error) {
                    console.error("Lead form submit failed:", error);
                    alert("提交失败，请稍后再试。");
                })
                .finally(function () {
                    if (submitButton) {
                        submitButton.textContent = "立即预约";
                        submitButton.disabled = false;
                    }
                });
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
