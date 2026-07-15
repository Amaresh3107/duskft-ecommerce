export const STOREFRONT = {
        header: 'storefront-header',
        logo: 'storefront-logo',
        navCatalogLink: 'storefront-nav-catalog-link',
        cartButton: 'storefront-cart-button',
        cartBadge: 'storefront-cart-badge',
        accountLink: 'storefront-account-link',
        logoutButton: 'storefront-logout-button',
        heroCta: 'storefront-hero-cta',
        categoryTile: (i) => `storefront-category-tile-${i}`,
        productCard: (i) => `storefront-product-card-${i}`,
        whatsappBanner: 'storefront-whatsapp-banner',
        footer: 'storefront-footer',
};

export const CATALOG = {
        searchInput: 'catalog-search-input',
        categorySelect: 'catalog-category-select',
        productGrid: 'catalog-product-grid',
        emptyState: 'catalog-empty-state',
};

export const PDP = {
        gallery: 'pdp-gallery',
        thumbnail: (i) => `pdp-thumbnail-${i}`,
        video: 'pdp-video',
        tierPricingTable: 'pdp-tier-pricing-table',
        moqNotice: 'pdp-moq-notice',
        matrix: 'pdp-color-size-matrix',
        matrixInput: (color, size) => `pdp-matrix-input-${color}-${size}`.replace(/\s+/g, '_'),
        addToCartButton: 'pdp-add-to-cart-button',
        wishlistButton: 'pdp-wishlist-button',
        whatsappInquireButton: 'pdp-whatsapp-inquire-button',
        runningTotal: 'pdp-running-total',
};

export const CART = {
        drawer: 'cart-drawer',
        line: (i) => `cart-line-${i}`,
        qtyInput: (i) => `cart-qty-input-${i}`,
        removeButton: (i) => `cart-remove-button-${i}`,
        subtotal: 'cart-subtotal',
        checkoutButton: 'cart-checkout-button',
        emptyState: 'cart-empty-state',
        moqWarning: (i) => `cart-moq-warning-${i}`,
};

export const CHECKOUT = {
        guestNameInput: 'checkout-guest-name-input',
        guestEmailInput: 'checkout-guest-email-input',
        guestPhoneInput: 'checkout-guest-phone-input',
        addressLine1Input: 'checkout-address-line1-input',
        addressLine2Input: 'checkout-address-line2-input',
        cityInput: 'checkout-city-input',
        stateInput: 'checkout-state-input',
        pincodeInput: 'checkout-pincode-input',
        savedAddressOption: (i) => `checkout-saved-address-option-${i}`,
        paymentMethodOption: (method) => `checkout-payment-method-${method}`,
        bankDetails: 'checkout-bank-details',
        upiDetails: 'checkout-upi-details',
        shippingCost: 'checkout-shipping-cost',
        taxEstimate: 'checkout-tax-estimate',
        orderTotal: 'checkout-order-total',
        placeOrderButton: 'checkout-place-order-button',
        loginPrompt: 'checkout-login-prompt',
        error: 'checkout-error',
};

export const ORDER_CONFIRM = {
        orderNumber: 'order-confirm-number',
        printInvoiceButton: 'order-confirm-print-invoice-button',
        continueShoppingButton: 'order-confirm-continue-shopping-button',
};

export const AUTH_PAGES = {
        loginEmailInput: 'login-email-input',
        loginPasswordInput: 'login-password-input',
        loginSubmitButton: 'login-submit-button',
        loginError: 'login-error',
        registerNameInput: 'register-name-input',
        registerEmailInput: 'register-email-input',
        registerPasswordInput: 'register-password-input',
        registerBusinessNameInput: 'register-business-name-input',
        registerSubmitButton: 'register-submit-button',
        registerError: 'register-error',
};
