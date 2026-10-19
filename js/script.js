(() => {
  const body = document.body;
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector("[data-menu-button]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* =========================================================
     Header / Mobile menu
  ========================================================= */
  const syncHeader = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  const closeMenu = () => {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute("aria-expanded", "false");
    mobileMenu.setAttribute("aria-hidden", "true");
    mobileMenu.classList.remove("is-open");
    header?.classList.remove("is-menu-open");
    body.classList.remove("menu-open");
  };

  const openMenu = () => {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute("aria-expanded", "true");
    mobileMenu.setAttribute("aria-hidden", "false");
    mobileMenu.classList.add("is-open");
    header?.classList.add("is-menu-open");
    body.classList.add("menu-open");
  };

  menuButton?.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  mobileMenu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1100) closeMenu();
  });

  /* =========================================================
     Product data
  ========================================================= */
  const productImage = document.querySelector("[data-product-image]");
  const productImageNext = document.querySelector("[data-product-image-next]");
  const productCaption = document.querySelector("[data-product-caption]");
  const productItems = [...document.querySelectorAll("[data-product-item]")];
  let currentImage = productImage?.getAttribute("src") || "";
  let requestedProduct = {
    image: currentImage,
    alt: productImage?.alt || "",
    caption: productCaption?.textContent.trim() || "",
  };
  let imageSwapBusy = false;
  let productImagesPreloaded = false;
  const productImageReady = new Map();

  const prepareProductImage = (src) => {
    if (productImageReady.has(src)) return productImageReady.get(src);

    const image = new Image();
    image.decoding = "async";

    const ready = new Promise((resolve, reject) => {
      image.addEventListener(
        "load",
        async () => {
          if (typeof image.decode === "function") {
            try {
              await image.decode();
            } catch {
              // A completed load is still safe to display if decode() is unavailable.
            }
          }
          resolve(image);
        },
        { once: true },
      );
      image.addEventListener("error", reject, { once: true });
      image.src = src;
    });

    productImageReady.set(src, ready);
    return ready;
  };

  const preloadProductImages = () => {
    if (productImagesPreloaded) return;
    productImagesPreloaded = true;

    productItems.forEach((item) => {
      const src = item.dataset.image;
      if (!src) return;
      void prepareProductImage(src).catch(() => {
        productImageReady.delete(src);
      });
    });
  };

  if (window.innerWidth >= 768) preloadProductImages();

  const hideIncomingProductImage = () => {
    if (!productImageNext) return;

    if (window.gsap) {
      gsap.set(productImageNext, {
        autoAlpha: 0,
        clearProps: "willChange",
      });
      return;
    }

    productImageNext.style.opacity = "0";
    productImageNext.style.visibility = "hidden";
  };

  const commitProductImage = (product) => {
    productImage.src = product.image;
    productImage.alt = product.alt;
    if (productCaption) productCaption.textContent = product.caption;
    currentImage = product.image;
  };

  const continueWithRequestedProduct = () => {
    imageSwapBusy = false;

    if (!requestedProduct.image || requestedProduct.image === currentImage) {
      if (productCaption) {
        productCaption.textContent = requestedProduct.caption;
      }
      return;
    }

    swapToRequestedProduct();
  };

  const swapToRequestedProduct = () => {
    if (imageSwapBusy || !productImage || !requestedProduct.image) return;

    if (requestedProduct.image === currentImage) {
      if (productCaption) {
        productCaption.textContent = requestedProduct.caption;
      }
      return;
    }

    const targetProduct = { ...requestedProduct };
    imageSwapBusy = true;

    void prepareProductImage(targetProduct.image)
      .then(async () => {
        if (requestedProduct.image !== targetProduct.image) {
          continueWithRequestedProduct();
          return;
        }

        if (!window.gsap || reducedMotion.matches || !productImageNext) {
          commitProductImage(targetProduct);
          continueWithRequestedProduct();
          return;
        }

        productImageNext.src = targetProduct.image;
        if (typeof productImageNext.decode === "function") {
          try {
            await productImageNext.decode();
          } catch {
            // The preloaded image can still be used if element decoding rejects.
          }
        }

        if (requestedProduct.image !== targetProduct.image) {
          hideIncomingProductImage();
          continueWithRequestedProduct();
          return;
        }

        gsap.set(productImageNext, {
          autoAlpha: 0,
          willChange: "opacity",
        });

        gsap.to(productImageNext, {
          autoAlpha: 1,
          duration: 0.5,
          ease: "power1.inOut",
          onComplete: () => {
            commitProductImage(targetProduct);
            hideIncomingProductImage();
            continueWithRequestedProduct();
          },
        });
      })
      .catch(() => {
        productImageReady.delete(targetProduct.image);
        imageSwapBusy = false;
        if (requestedProduct.image !== targetProduct.image) {
          swapToRequestedProduct();
        }
      });
  };

  const setActiveProduct = (item) => {
    if (!item || !productImage || window.innerWidth < 768) return;

    productItems.forEach((product) => {
      product.classList.toggle("is-active", product === item);
    });

    requestedProduct = {
      image: item.dataset.image,
      alt: item.dataset.alt || "",
      caption: item.dataset.caption || "",
    };

    swapToRequestedProduct();
  };

  const setupProductFallback = () => {
    if (!("IntersectionObserver" in window) || !productItems.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]) setActiveProduct(visible[0].target);
      },
      {
        threshold: [0.25, 0.45, 0.65],
        rootMargin: "-18% 0px -28% 0px",
      },
    );

    productItems.forEach((item) => observer.observe(item));
  };

  /* =========================================================
     GSAP motion
  ========================================================= */
  const initGsap = () => {
    if (!window.gsap || !window.ScrollTrigger) {
      // CDN unavailable: keep the complete static layout and retain product switching.
      setupProductFallback();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    if (reducedMotion.matches) {
      const reducedMm = gsap.matchMedia();
      reducedMm.add("(min-width: 768px)", () => {
        preloadProductImages();
        productItems.forEach((item) => {
          // Product switching remains functional without decorative motion.
          ScrollTrigger.create({
            trigger: item,
            start: "top 52%",
            end: "bottom 48%",
            onEnter: () => setActiveProduct(item),
            onEnterBack: () => setActiveProduct(item),
          });
        });
      });
      return;
    }

    const mm = gsap.matchMedia();

    /* Section titles: a quiet whole-title reveal.
       Hero and lashes stay visible without waiting for animation playback. */
    const titleElements = gsap.utils.toArray(
      ".section-title:not(#lashes-title), .section-title--small",
    );

    const animateTitle = (title) => {
      gsap.set(title, {
        "--title-line-scale": 0,
        autoAlpha: 0,
        y: 8,
      });
      gsap
        .timeline({
          scrollTrigger: {
            trigger: title,
            start: "top 80%",
            once: true,
          },
        })
        .to(title, {
          autoAlpha: 1,
          y: 0,
          duration: 0.95,
          ease: "power2.out",
        })
        .to(
          title,
          {
            "--title-line-scale": 1,
            duration: 0.9,
            ease: "power2.out",
          },
          "-=0.58",
        )
        .set(title, {
          clearProps: "transform,opacity,visibility,--title-line-scale",
        });
    };

    titleElements.forEach(animateTitle);

    /* Product sticky image switching: ScrollTrigger owns activation. */
    mm.add("(min-width: 768px)", () => {
      preloadProductImages();

      productItems.forEach((item) => {
        ScrollTrigger.create({
          trigger: item,
          start: "top 54%",
          end: "bottom 46%",
          onEnter: () => setActiveProduct(item),
          onEnterBack: () => setActiveProduct(item),
        });
      });
    });

    /* Routine: one timeline because sequence itself has meaning. */
    const routine = document.querySelector("[data-routine]");
    if (routine) {
      const steps = routine.querySelectorAll(".routine-step");
      gsap.from(steps, {
        autoAlpha: 0,
        y: 6,
        duration: 0.75,
        stagger: 0.07,
        ease: "power2.out",
        scrollTrigger: {
          trigger: routine,
          start: "top 78%",
          once: true,
        },
        onComplete: () => {
          gsap.set(steps, { clearProps: "transform,opacity,visibility" });
        },
      });
    }

    const iceCopy = document.querySelector("[data-ice-copy]");
    if (iceCopy) {
      gsap.from(iceCopy, {
        autoAlpha: 0,
        duration: 0.9,
        ease: "power2.out",
        scrollTrigger: {
          trigger: iceCopy,
          start: "top 76%",
          once: true,
        },
        onComplete: () => {
          gsap.set(iceCopy, { clearProps: "opacity,visibility" });
        },
      });
    }

    /* Final CTA: one calm fade rather than a sequence of small movements. */
    const shopMotion = document.querySelector("[data-shop-motion]");
    if (shopMotion) {
      gsap.from(shopMotion, {
        autoAlpha: 0,
        duration: 0.9,
        ease: "power2.out",
        scrollTrigger: {
          trigger: shopMotion,
          start: "top 76%",
          once: true,
        },
        onComplete: () => {
          gsap.set(shopMotion, { clearProps: "opacity,visibility" });
        },
      });
    }

    window.addEventListener("load", () => ScrollTrigger.refresh(), {
      once: true,
    });
  };

  initGsap();

  /* =========================================================
     Contact form preview
  ========================================================= */
  const contactForm = document.querySelector("[data-contact-form]");
  const formStatus = document.querySelector("[data-form-status]");

  contactForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    const formData = new FormData(contactForm);
    const topic = formData.get("topic") || "お問い合わせ";
    if (formStatus) {
      formStatus.textContent = `「${topic}」の入力内容を確認しました。現在は確認版のため送信されません。`;
    }
  });

  /* =========================================================
     Current year
  ========================================================= */
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
