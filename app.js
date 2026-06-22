"use strict";

(() => {
  const PRODUCT_IMAGE_FALLBACK = "assets/product-placeholder.svg";
  const CART_STORAGE_KEY = "griffin-cart-items";
  const USER_PRODUCTS_STORAGE_KEY = "griffin-user-products";
  const MAX_IMAGE_SIZE_BYTES = 900 * 1024;

  const productTracks = document.querySelectorAll("[data-products-track]");
  const cartTriggers = document.querySelectorAll("[data-cart-trigger]");
  const cartCounters = document.querySelectorAll("[data-cart-count]");
  const sellForm = document.querySelector("[data-sell-form]");
  const imageInput = document.querySelector("[data-sell-image-input]");
  const imageDropzone = document.querySelector("[data-sell-dropzone]");
  const imagePreview = document.querySelector("[data-sell-image-preview]");
  const imageFeedback = document.querySelector("[data-sell-image-feedback]");
  const sellStatus = document.querySelector("[data-sell-status]");
  const hasProductData = typeof productos !== "undefined" && Array.isArray(productos);

  if (!hasProductData) {
    return;
  }

  let selectedProductId = null;
  let selectedSellerImage = PRODUCT_IMAGE_FALLBACK;

  const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

  const formatPrice = (price) => {
    return `$ ${Number(price).toLocaleString("es-AR")}`;
  };

  const formatValue = (value) => {
    const normalizedValue = String(value ?? "").trim();
    return normalizedValue || "sin especificar";
  };

  const escapeHTML = (value) => {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const getStoredJSON = (storage, key, fallback = []) => {
    try {
      const parsedValue = JSON.parse(storage.getItem(key));
      return Array.isArray(parsedValue) ? parsedValue : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const sanitizeProduct = (product) => {
    if (!product || !product.idProducto || !product.nombre) {
      return null;
    }

    return {
      idProducto: String(product.idProducto).trim(),
      nombre: normalizeText(product.nombre),
      genero: normalizeText(product.genero),
      categoria: normalizeText(product.categoria),
      talle: normalizeText(product.talle),
      estado: normalizeText(product.estado),
      precio: Math.max(0, Number(product.precio) || 0),
      stock: Math.max(1, Number(product.stock) || 1),
      imagen: String(product.imagen || PRODUCT_IMAGE_FALLBACK),
      descripcion: normalizeText(product.descripcion),
      vendedor: normalizeText(product.vendedor) || "usuario vendedor",
      esOutlet: Boolean(product.esOutlet),
      disponible: product.disponible !== false
    };
  };

  const getStoredUserProducts = () => {
    return getStoredJSON(localStorage, USER_PRODUCTS_STORAGE_KEY)
      .map(sanitizeProduct)
      .filter(Boolean);
  };

  const saveUserProducts = (userProducts) => {
    localStorage.setItem(USER_PRODUCTS_STORAGE_KEY, JSON.stringify(userProducts));
  };

  const getProductCatalog = () => {
    return [...productos, ...getStoredUserProducts()];
  };

  const findProductById = (productId) => {
    return getProductCatalog().find((producto) => normalizeText(producto.idProducto) === normalizeText(productId));
  };

  const getStoredCart = () => {
    return getStoredJSON(sessionStorage, CART_STORAGE_KEY)
      .filter((item) => item && item.idProducto)
      .map((item) => ({
        idProducto: String(item.idProducto),
        cantidad: Math.max(1, Number(item.cantidad) || 1)
      }));
  };

  const saveCart = (cartItems) => {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  };

  const clearCart = () => {
    sessionStorage.removeItem(CART_STORAGE_KEY);
  };

  const isProductInCart = (productId) => {
    return getStoredCart().some((item) => normalizeText(item.idProducto) === normalizeText(productId));
  };

  const getCartCount = () => {
    return getStoredCart().reduce((total, item) => total + item.cantidad, 0);
  };

  const updateCartCounter = () => {
    const cartCount = getCartCount();

    cartCounters.forEach((counter) => {
      counter.textContent = String(cartCount);
      counter.setAttribute("aria-label", `${cartCount} producto${cartCount === 1 ? "" : "s"} en carrito`);
      counter.dataset.empty = String(cartCount === 0);
    });
  };

  const addProductToCart = (productId) => {
    const product = findProductById(productId);

    if (!product) {
      return [];
    }

    const cartItems = getStoredCart();
    const currentItem = cartItems.find((item) => normalizeText(item.idProducto) === normalizeText(productId));
    const productStock = Math.max(1, Number(product.stock) || 1);

    if (currentItem) {
      currentItem.cantidad = Math.min(productStock, currentItem.cantidad + 1);
    } else {
      cartItems.push({
        idProducto: product.idProducto,
        cantidad: 1
      });
    }

    saveCart(cartItems);
    updateCartCounter();
    return cartItems;
  };

  const removeProductFromCart = (productId) => {
    const updatedCart = getStoredCart().filter((item) => normalizeText(item.idProducto) !== normalizeText(productId));
    saveCart(updatedCart);
    updateCartCounter();
    return updatedCart;
  };

  const createCartDrawer = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "cart-drawer";
    dialog.id = "cart-drawer";
    dialog.setAttribute("aria-labelledby", "cart-drawer-title");
    dialog.setAttribute("data-cart-drawer", "");

    dialog.innerHTML = `
      <article class="cart-drawer__panel">
        <header class="cart-drawer__header">
          <section class="cart-drawer__heading" aria-label="resumen del carrito">
            <p class="cart-drawer__eyebrow">Checkout</p>
            <h2 class="cart-drawer__title" id="cart-drawer-title">mi carrito</h2>
          </section>

          <button class="cart-drawer__close" type="button" data-cart-close aria-label="cerrar carrito">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </header>

        <section class="cart-drawer__body" aria-live="polite" aria-label="productos agregados al carrito">
          <p class="cart-drawer__empty" data-cart-empty>Tu carrito está vacío por ahora.</p>
          <ol class="cart-drawer__list" data-cart-list aria-label="lista de productos en carrito"></ol>
        </section>

        <footer class="cart-drawer__footer">
          <p class="cart-drawer__total">
            <span>Total</span>
            <strong data-cart-total>$ 0</strong>
          </p>

          <button class="button button--primary cart-drawer__checkout" type="button" data-cart-checkout>
            Finalizar compra
          </button>

        </footer>
      </article>

      <section class="checkout-feedback" data-cart-success hidden role="status" aria-live="polite" aria-label="confirmación de compra simulada">
        <article class="checkout-feedback__card" aria-labelledby="checkout-feedback-title">
          <p class="checkout-feedback__eyebrow">checkout simulado</p>
          <h2 class="checkout-feedback__title" id="checkout-feedback-title">compra finalizada</h2>
          <p class="checkout-feedback__message">Tu compra fue registrada correctamente. Gracias por usar el checkout simulado de Griffin Clothing.</p>
          <button class="button button--secondary checkout-feedback__button" type="button" data-cart-success-close>
            seguir comprando
          </button>
        </article>
      </section>
    `;

    document.body.appendChild(dialog);
    return dialog;
  };

  const cartDrawer = cartTriggers.length ? createCartDrawer() : null;
  const cartList = cartDrawer?.querySelector("[data-cart-list]");
  const cartEmpty = cartDrawer?.querySelector("[data-cart-empty]");
  const cartSuccess = cartDrawer?.querySelector("[data-cart-success]");
  const cartTotal = cartDrawer?.querySelector("[data-cart-total]");
  const cartCheckout = cartDrawer?.querySelector("[data-cart-checkout]");
  const closeCartButton = cartDrawer?.querySelector("[data-cart-close]");
  const closeCartSuccessButton = cartDrawer?.querySelector("[data-cart-success-close]");

  const hideCartSuccess = () => {
    if (cartSuccess) {
      cartSuccess.hidden = true;
    }
  };

  const showCartSuccess = () => {
    if (!cartSuccess) {
      return;
    }

    cartSuccess.hidden = false;
  };

  const createCartItem = (cartItem) => {
    const product = findProductById(cartItem.idProducto);

    if (!product) {
      return null;
    }

    const item = document.createElement("li");
    item.className = "cart-drawer__item";

    item.innerHTML = `
      <article class="cart-item" aria-labelledby="cart-item-${escapeHTML(product.idProducto)}-title">
        <figure class="cart-item__figure">
          <img
            class="cart-item__image"
            src="${escapeHTML(product.imagen || PRODUCT_IMAGE_FALLBACK)}"
            alt="${escapeHTML(product.nombre)}"
            width="180"
            height="180"
            loading="lazy"
          >
        </figure>

        <section class="cart-item__content" aria-label="detalle de ${escapeHTML(product.nombre)}">
          <header class="cart-item__header">
            <h3 class="cart-item__title" id="cart-item-${escapeHTML(product.idProducto)}-title">${escapeHTML(product.nombre)}</h3>
            <p class="cart-item__price">${formatPrice(product.precio)}</p>
          </header>

          <p class="cart-item__meta">talle ${escapeHTML(formatValue(product.talle))} · cantidad ${cartItem.cantidad}</p>
          <p class="cart-item__seller">vendedor: ${escapeHTML(formatValue(product.vendedor))}</p>

          <button class="cart-item__remove" type="button" data-cart-remove="${escapeHTML(product.idProducto)}" aria-label="quitar ${escapeHTML(product.nombre)} del carrito">
            quitar
          </button>
        </section>
      </article>
    `;

    const image = item.querySelector(".cart-item__image");

    image.addEventListener("error", () => {
      image.src = PRODUCT_IMAGE_FALLBACK;
    }, { once: true });

    return item;
  };

  const renderCartDrawer = ({ keepSuccess = false } = {}) => {
    if (!cartDrawer || !cartList || !cartEmpty || !cartTotal || !cartCheckout) {
      return;
    }

    if (!keepSuccess) {
      hideCartSuccess();
    }

    const cartItems = getStoredCart();
    const visibleItems = cartItems.filter((item) => findProductById(item.idProducto));
    const total = visibleItems.reduce((sum, item) => {
      const product = findProductById(item.idProducto);
      return sum + (Number(product?.precio) || 0) * item.cantidad;
    }, 0);

    cartList.replaceChildren();

    visibleItems.forEach((item) => {
      const cartItem = createCartItem(item);

      if (cartItem) {
        cartList.appendChild(cartItem);
      }
    });

    cartEmpty.hidden = visibleItems.length > 0;
    cartList.hidden = visibleItems.length === 0;
    cartTotal.textContent = formatPrice(total);
    cartCheckout.disabled = visibleItems.length === 0;
  };

  const openCartDrawer = () => {
    if (!cartDrawer || !closeCartButton) {
      return;
    }

    renderCartDrawer();
    cartDrawer.showModal();
    closeCartButton.focus();
  };

  const closeCartDrawer = () => {
    cartDrawer?.close();
  };

  const syncProductDialogCartState = () => {
    if (!selectedProductId || !addToCartButton || !removeFromCartButton) {
      return;
    }

    const productIsInCart = isProductInCart(selectedProductId);
    addToCartButton.hidden = productIsInCart;
    removeFromCartButton.hidden = !productIsInCart;
  };

  const createProductDialog = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "product-detail";
    dialog.setAttribute("aria-labelledby", "product-detail-title");
    dialog.setAttribute("data-product-dialog", "");

    dialog.innerHTML = `
      <article class="product-detail__card">
        <button class="product-detail__close" type="button" data-product-dialog-close aria-label="cerrar detalle del producto">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>

        <figure class="product-detail__figure">
          <img
            class="product-detail__image"
            src="${PRODUCT_IMAGE_FALLBACK}"
            alt=""
            width="900"
            height="900"
            data-product-dialog-image
          >
        </figure>

        <section class="product-detail__content" aria-label="especificaciones del producto seleccionado">
          <header class="product-detail__header">
            <p class="product-detail__eyebrow" data-product-dialog-code></p>
            <h2 class="product-detail__title" id="product-detail-title" data-product-dialog-title></h2>
            <p class="product-detail__description" data-product-dialog-description></p>
          </header>

          <p class="product-detail__price" data-product-dialog-price></p>

          <dl class="product-detail__specs">
            <dt class="product-detail__term">talle</dt>
            <dd class="product-detail__value" data-product-dialog-size></dd>

            <dt class="product-detail__term">estado</dt>
            <dd class="product-detail__value" data-product-dialog-condition></dd>

            <dt class="product-detail__term">stock</dt>
            <dd class="product-detail__value" data-product-dialog-stock></dd>

            <dt class="product-detail__term">vendedor</dt>
            <dd class="product-detail__value" data-product-dialog-seller></dd>
          </dl>

          <menu class="product-detail__actions" aria-label="acciones del producto">
            <li class="product-detail__action-slot">
              <button class="button button--primary product-detail__action" type="button" data-product-dialog-add>
                Agregar a carrito
              </button>
              <button class="button button--secondary product-detail__action product-detail__action--remove" type="button" data-product-dialog-remove hidden>
                Eliminar de carrito
              </button>
            </li>
          </menu>
        </section>
      </article>
    `;

    document.body.appendChild(dialog);
    return dialog;
  };

  const shouldCreateProductDialog = productTracks.length > 0;
  const productDialog = shouldCreateProductDialog ? createProductDialog() : null;
  const dialogImage = productDialog?.querySelector("[data-product-dialog-image]");
  const dialogCode = productDialog?.querySelector("[data-product-dialog-code]");
  const dialogTitle = productDialog?.querySelector("[data-product-dialog-title]");
  const dialogDescription = productDialog?.querySelector("[data-product-dialog-description]");
  const dialogPrice = productDialog?.querySelector("[data-product-dialog-price]");
  const dialogSize = productDialog?.querySelector("[data-product-dialog-size]");
  const dialogCondition = productDialog?.querySelector("[data-product-dialog-condition]");
  const dialogStock = productDialog?.querySelector("[data-product-dialog-stock]");
  const dialogSeller = productDialog?.querySelector("[data-product-dialog-seller]");
  const addToCartButton = productDialog?.querySelector("[data-product-dialog-add]");
  const removeFromCartButton = productDialog?.querySelector("[data-product-dialog-remove]");
  const closeDialogButton = productDialog?.querySelector("[data-product-dialog-close]");

  const openProductDialog = (producto) => {
    if (!productDialog || !dialogImage || !dialogCode || !dialogTitle || !dialogDescription || !dialogPrice || !dialogSize || !dialogCondition || !dialogStock || !dialogSeller || !closeDialogButton) {
      return;
    }

    selectedProductId = producto.idProducto;

    dialogImage.src = producto.imagen || PRODUCT_IMAGE_FALLBACK;
    dialogImage.alt = producto.nombre;
    dialogCode.textContent = `código ${formatValue(producto.idProducto).toUpperCase()}`;
    dialogTitle.textContent = formatValue(producto.nombre);
    dialogDescription.textContent = formatValue(producto.descripcion);
    dialogPrice.textContent = formatPrice(producto.precio);
    dialogSize.textContent = formatValue(producto.talle);
    dialogCondition.textContent = formatValue(producto.estado);
    dialogStock.textContent = `${Number(producto.stock)} disponible${Number(producto.stock) === 1 ? "" : "s"}`;
    dialogSeller.textContent = formatValue(producto.vendedor);

    syncProductDialogCartState();
    productDialog.showModal();
    closeDialogButton.focus();
  };

  const closeProductDialog = () => {
    selectedProductId = null;
    productDialog?.close();
  };

  const createProductCard = (producto) => {
    const productId = `producto-${producto.idProducto}`;
    const productNameId = `${productId}-nombre`;

    const item = document.createElement("li");
    item.className = "product-carousel__item";
    item.id = productId;

    item.innerHTML = `
      <article
        class="product-card"
        aria-labelledby="${escapeHTML(productNameId)}"
        data-product-card
        data-product-id="${escapeHTML(producto.idProducto)}"
        role="button"
        tabindex="0"
      >
        <figure class="product-card__figure">
          <img
            class="product-card__image"
            src="${escapeHTML(producto.imagen || PRODUCT_IMAGE_FALLBACK)}"
            alt="${escapeHTML(producto.nombre)}"
            width="720"
            height="720"
            loading="lazy"
          >
          <button
            class="product-card__favorite"
            type="button"
            aria-label="añadir ${escapeHTML(producto.nombre)} a favoritos"
            aria-pressed="false"
          >
            <span class="material-symbols-outlined" aria-hidden="true">favorite</span>
          </button>
        </figure>
        <p class="product-card__price">${formatPrice(producto.precio)}</p>
        <h4 class="product-card__name" id="${escapeHTML(productNameId)}">${escapeHTML(producto.nombre)}</h4>
        <p class="product-card__meta">código ${escapeHTML(producto.idProducto.toUpperCase())} · talle ${escapeHTML(producto.talle)}</p>
      </article>
    `;

    const image = item.querySelector(".product-card__image");

    image.addEventListener("error", () => {
      image.src = PRODUCT_IMAGE_FALLBACK;
    }, { once: true });

    return item;
  };

  const createEmptyState = () => {
    const item = document.createElement("li");
    item.className = "product-carousel__item product-carousel__item--empty";
    item.innerHTML = `
      <article class="product-card product-card--empty" aria-label="No hay productos disponibles">
        <p class="product-card__meta">No hay productos disponibles para esta categoría.</p>
      </article>
    `;
    return item;
  };

  const updateCarouselArrow = (track, renderedProducts) => {
    const carousel = track.closest(".product-carousel");
    const arrow = carousel?.querySelector("[data-carousel-arrow]");

    if (!arrow) {
      return;
    }

    if (renderedProducts.length > 2) {
      arrow.href = `#producto-${renderedProducts[2].idProducto}`;
      arrow.hidden = false;
      return;
    }

    arrow.hidden = true;
  };

  const renderProducts = (track) => {
    const selectedGender = normalizeText(track.dataset.genero);
    const selectedCategory = normalizeText(track.dataset.categoria);

    const filteredProducts = getProductCatalog().filter((producto) => {
      return normalizeText(producto.genero) === selectedGender
        && normalizeText(producto.categoria) === selectedCategory
        && producto.disponible;
    });

    track.replaceChildren();

    if (!filteredProducts.length) {
      track.appendChild(createEmptyState());
      updateCarouselArrow(track, filteredProducts);
      return;
    }

    filteredProducts.forEach((producto) => {
      track.appendChild(createProductCard(producto));
    });

    updateCarouselArrow(track, filteredProducts);
  };

  const getNextUserProductId = () => {
    const storedProducts = getStoredUserProducts();
    const highestIdNumber = storedProducts.reduce((highest, producto) => {
      const idMatch = String(producto.idProducto).match(/^usr(\d+)$/i);
      const currentNumber = idMatch ? Number(idMatch[1]) : 0;
      return Math.max(highest, currentNumber);
    }, 0);

    return `USR${String(highestIdNumber + 1).padStart(3, "0")}`;
  };

  const setSellerStatus = (message, type = "info", targetUrl = "") => {
    if (!sellStatus) {
      return;
    }

    sellStatus.dataset.type = type;

    if (targetUrl) {
      sellStatus.innerHTML = `${escapeHTML(message)} <a class="sell-form__status-link" href="${escapeHTML(targetUrl)}">ver publicación</a>`;
      return;
    }

    sellStatus.textContent = message;
  };

  const updateSellerImagePreview = (imageSource, message = "imagen cargada correctamente.") => {
    selectedSellerImage = imageSource || PRODUCT_IMAGE_FALLBACK;

    if (imagePreview) {
      imagePreview.src = selectedSellerImage;
      imagePreview.hidden = selectedSellerImage === PRODUCT_IMAGE_FALLBACK;
    }

    if (imageFeedback) {
      imageFeedback.textContent = message;
    }
  };

  const handleSellerImageFile = (file) => {
    if (!file) {
      updateSellerImagePreview(PRODUCT_IMAGE_FALLBACK, "podés cargar una imagen del producto, o publicar usando la imagen temporal.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      updateSellerImagePreview(PRODUCT_IMAGE_FALLBACK, "el archivo debe ser una imagen.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      updateSellerImagePreview(PRODUCT_IMAGE_FALLBACK, "la imagen supera el tamaño sugerido. usá una imagen menor a 900 kb.");
      return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      updateSellerImagePreview(String(reader.result), "imagen cargada correctamente.");
    });

    reader.addEventListener("error", () => {
      updateSellerImagePreview(PRODUCT_IMAGE_FALLBACK, "no se pudo leer la imagen. se usará una imagen temporal.");
    });

    reader.readAsDataURL(file);
  };

  const getProductTargetUrl = (product) => {
    const page = product.genero === "outlet" ? "outlet.html" : `${product.genero}.html`;
    const pluralCategory = {
      remera: "remeras",
      sweater: "sweaters",
      campera: "camperas",
      pantalon: "pantalones",
      zapatilla: "zapatillas",
      zapato: "zapatos"
    }[product.categoria] ?? "remeras";

    return `${page}#${pluralCategory}`;
  };

  const createProductFromForm = (form) => {
    const formData = new FormData(form);
    const selectedGender = normalizeText(formData.get("producto-genero"));
    const selectedCategory = normalizeText(formData.get("producto-categoria"));

    return {
      idProducto: getNextUserProductId(),
      nombre: normalizeText(formData.get("producto-nombre")),
      genero: selectedGender,
      categoria: selectedCategory,
      talle: normalizeText(formData.get("producto-talle")),
      estado: normalizeText(formData.get("producto-estado")),
      precio: Math.max(0, Number(formData.get("producto-precio")) || 0),
      stock: Math.max(1, Number(formData.get("producto-stock")) || 1),
      imagen: selectedSellerImage || PRODUCT_IMAGE_FALLBACK,
      descripcion: normalizeText(formData.get("producto-descripcion")) || "prenda publicada por un usuario desde la sección vender.",
      vendedor: normalizeText(formData.get("producto-vendedor")) || "usuario vendedor",
      esOutlet: selectedGender === "outlet",
      disponible: true
    };
  };

  const resetSellForm = () => {
    if (!sellForm) {
      return;
    }

    sellForm.reset();
    selectedSellerImage = PRODUCT_IMAGE_FALLBACK;

    if (imagePreview) {
      imagePreview.src = PRODUCT_IMAGE_FALLBACK;
      imagePreview.hidden = true;
    }

    if (imageFeedback) {
      imageFeedback.textContent = "arrastrá una imagen o elegila desde tu equipo. si no cargás una, se usará una imagen temporal.";
    }
  };

  const publishSellerProduct = (event) => {
    event.preventDefault();

    if (!sellForm?.reportValidity()) {
      return;
    }

    const newProduct = createProductFromForm(sellForm);

    if (!newProduct.nombre || !newProduct.genero || !newProduct.categoria || !newProduct.talle || !newProduct.estado || !newProduct.precio || !newProduct.stock) {
      setSellerStatus("revisá los datos obligatorios antes de publicar.", "error");
      return;
    }

    const userProducts = getStoredUserProducts();
    userProducts.push(newProduct);

    try {
      saveUserProducts(userProducts);
      const targetUrl = getProductTargetUrl(newProduct);
      setSellerStatus(`publicación guardada correctamente con código ${newProduct.idProducto}.`, "success", targetUrl);
      resetSellForm();
    } catch (error) {
      setSellerStatus("no se pudo guardar la publicación. probá con una imagen más liviana.", "error");
    }
  };

  productTracks.forEach(renderProducts);
  updateCartCounter();

  sellForm?.addEventListener("submit", publishSellerProduct);

  imageInput?.addEventListener("change", () => {
    handleSellerImageFile(imageInput.files?.[0]);
  });

  imageDropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    imageDropzone.dataset.dragging = "true";
  });

  imageDropzone?.addEventListener("dragleave", () => {
    imageDropzone.dataset.dragging = "false";
  });

  imageDropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    imageDropzone.dataset.dragging = "false";
    const file = event.dataTransfer?.files?.[0];

    if (imageInput && file) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      imageInput.files = dataTransfer.files;
    }

    handleSellerImageFile(file);
  });

  cartTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openCartDrawer();
    });
  });

  closeCartButton?.addEventListener("click", closeCartDrawer);

  closeCartSuccessButton?.addEventListener("click", hideCartSuccess);

  cartCheckout?.addEventListener("click", () => {
    if (getCartCount() === 0) {
      return;
    }

    clearCart();
    updateCartCounter();
    renderCartDrawer({ keepSuccess: true });
    showCartSuccess();
    syncProductDialogCartState();
  });

  cartDrawer?.addEventListener("click", (event) => {
    if (event.target === cartDrawer) {
      closeCartDrawer();
      return;
    }

    if (event.target === cartSuccess) {
      hideCartSuccess();
      return;
    }

    const removeButton = event.target.closest("[data-cart-remove]");

    if (!removeButton) {
      return;
    }

    removeProductFromCart(removeButton.dataset.cartRemove);
    renderCartDrawer();
    syncProductDialogCartState();
  });

  document.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest(".product-card__favorite");

    if (favoriteButton) {
      event.stopPropagation();
      const isPressed = favoriteButton.getAttribute("aria-pressed") === "true";
      favoriteButton.setAttribute("aria-pressed", String(!isPressed));
      return;
    }

    const productCard = event.target.closest("[data-product-card]");

    if (!productCard) {
      return;
    }

    const selectedProduct = findProductById(productCard.dataset.productId);

    if (selectedProduct) {
      openProductDialog(selectedProduct);
    }
  });

  document.addEventListener("keydown", (event) => {
    const productCard = event.target.closest("[data-product-card]");

    if (!productCard || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    const selectedProduct = findProductById(productCard.dataset.productId);

    if (selectedProduct) {
      openProductDialog(selectedProduct);
    }
  });

  closeDialogButton?.addEventListener("click", closeProductDialog);

  productDialog?.addEventListener("click", (event) => {
    if (event.target === productDialog) {
      closeProductDialog();
    }
  });

  dialogImage?.addEventListener("error", () => {
    dialogImage.src = PRODUCT_IMAGE_FALLBACK;
  });

  addToCartButton?.addEventListener("click", () => {
    if (!selectedProductId) {
      return;
    }

    hideCartSuccess();
    addProductToCart(selectedProductId);
    renderCartDrawer();
    syncProductDialogCartState();
    removeFromCartButton?.focus();
  });

  removeFromCartButton?.addEventListener("click", () => {
    if (!selectedProductId) {
      return;
    }

    removeProductFromCart(selectedProductId);
    renderCartDrawer();
    syncProductDialogCartState();
    addToCartButton?.focus();
  });
})();
