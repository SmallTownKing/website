document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initCasesCarousel();
    initLeadForm();
});

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

function initCasesCarousel() {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverQuery = window.matchMedia("(hover: hover)");

    document.querySelectorAll(".cases-carousel").forEach(function (carousel) {
        const track = carousel.querySelector(".carousel-track-inner");
        const originalItems = Array.from(track ? track.children : []);
        const prevBtn = carousel.querySelector("[data-carousel-prev]");
        const nextBtn = carousel.querySelector("[data-carousel-next]");
        const section = carousel.closest("section");
        const dotsContainer = section ? section.querySelector("[data-carousel-dots]") : null;

        if (!track || !originalItems.length || !prevBtn || !nextBtn) {
            return;
        }

        const hasMultipleItems = originalItems.length > 1;
        let items = originalItems.slice();
        let autoplayTimer = null;
        let dotButtons = [];
        let currentPage = hasMultipleItems ? 1 : 0;
        let isAnimating = false;

        if (hasMultipleItems) {
            const firstClone = originalItems[0].cloneNode(true);
            const lastClone = originalItems[originalItems.length - 1].cloneNode(true);

            firstClone.setAttribute("data-carousel-clone", "true");
            firstClone.setAttribute("aria-hidden", "true");
            lastClone.setAttribute("data-carousel-clone", "true");
            lastClone.setAttribute("aria-hidden", "true");

            track.insertBefore(lastClone, track.firstChild);
            track.appendChild(firstClone);
            items = Array.from(track.children);
        }

        const getPageCount = function () {
            return originalItems.length;
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
    });
}

function initLeadForm() {
    document.querySelectorAll(".lead-gen-form").forEach(function (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
        });
    });
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
