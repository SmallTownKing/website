document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initCasesCarousel();
    initLeadForm();
});

function initHeader() {
    const header = document.getElementById("header");

    if (!header) {
        return;
    }

    const syncHeaderState = function () {
        header.classList.toggle("scrolled", window.scrollY > 24);
    };

    window.addEventListener("scroll", syncHeaderState, { passive: true });
    syncHeaderState();
}

function initCasesCarousel() {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverQuery = window.matchMedia("(hover: hover)");

    document.querySelectorAll(".cases-carousel").forEach(function (carousel) {
        const track = carousel.querySelector(".carousel-track-inner");
        const items = Array.from(track ? track.children : []);
        const prevBtn = carousel.querySelector("[data-carousel-prev]");
        const nextBtn = carousel.querySelector("[data-carousel-next]");
        const section = carousel.closest("section");
        const dotsContainer = section ? section.querySelector("[data-carousel-dots]") : null;

        if (!track || !items.length || !prevBtn || !nextBtn) {
            return;
        }

        let currentPage = 0;
        let autoplayTimer = null;
        let dotButtons = [];

        const getVisibleCount = function () {
            return window.innerWidth <= 900 ? 1 : 2;
        };

        const getPageStarts = function () {
            const visibleCount = getVisibleCount();

            if (items.length <= visibleCount) {
                return [0];
            }

            const pageStarts = [];

            for (let index = 0; index < items.length; index += visibleCount) {
                const pageStart = Math.min(index, items.length - visibleCount);

                if (pageStarts[pageStarts.length - 1] !== pageStart) {
                    pageStarts.push(pageStart);
                }
            }

            return pageStarts;
        };

        const getPageCount = function () {
            return getPageStarts().length;
        };

        const findPageByStart = function (itemStart) {
            const pageStarts = getPageStarts();
            let matchedPage = 0;

            pageStarts.forEach(function (pageStart, index) {
                if (pageStart <= itemStart) {
                    matchedPage = index;
                }
            });

            return matchedPage;
        };

        const getGap = function () {
            const styles = window.getComputedStyle(track);
            return parseFloat(styles.columnGap || styles.gap || 0);
        };

        const shouldAutoplay = function () {
            return window.innerWidth > 900 && !reducedMotionQuery.matches && getPageCount() > 1;
        };

        const updateCarousel = function () {
            const pageStarts = getPageStarts();
            currentPage = Math.min(currentPage, pageStarts.length - 1);

            const itemWidth = items[0].getBoundingClientRect().width;
            const offset = pageStarts[currentPage] * (itemWidth + getGap());
            track.style.transform = "translateX(-" + offset + "px)";

            const disabled = pageStarts.length <= 1;
            prevBtn.disabled = disabled;
            nextBtn.disabled = disabled;

            dotButtons.forEach(function (dot, index) {
                dot.classList.toggle("active", index === currentPage);
            });
        };

        const goToPage = function (nextPage) {
            const pageCount = getPageCount();
            currentPage = pageCount <= 1 ? 0 : (nextPage + pageCount) % pageCount;
            updateCarousel();
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
                    goToPage(index);
                    startAutoplay();
                });
                dotsContainer.appendChild(dot);
                dotButtons.push(dot);
            }
        };

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
                const currentStart = getPageStarts()[currentPage] || 0;
                renderDots();
                currentPage = findPageByStart(currentStart);
                updateCarousel();
                startAutoplay();
            }, 120),
            { passive: true }
        );

        renderDots();
        updateCarousel();
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
