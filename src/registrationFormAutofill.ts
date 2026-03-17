import type { PersonalInfoV1, CredentialsV1 } from './ContentUtils';
import { sendLogtoBack, findCredentialsByDomain } from './ContentUtils';
import type { personalInfoFields_v1 } from './Options/components/dashboard/MainDataTypes';
import CryptoJS from 'crypto-js';
import { inputDataWithElement } from './autofillContent';
import { callRegistrationFormAI, callRegistrationFormAI2 } from './registrationFormAutofillAI';

/**
 * Collects select/dropdown elements from the page
 */
const collectSelectElements = (): HTMLSelectElement[] => {
    const results: HTMLSelectElement[] = [];

    try {
        // Collect from main document
        const selects = document.querySelectorAll('select');
        console.log('selects', selects);
        selects.forEach((select) => {
            const parentDiv = select.closest('div[id*="byteseal" i]');
            if (!parentDiv && isVisibleDeep(select)) {
                results.push(select);
            }
        });

        // Collect from iframes
        function findSelectsInFrames(win: Window): HTMLSelectElement[] {
            const collected: HTMLSelectElement[] = [];

            for (let i = 0; i < win.frames.length; i++) {
                const frameWin = win.frames[i];
                try {
                    const doc = frameWin.document;
                    if (doc.querySelector('div[id*="byteseal_floatdiv"]')) {
                        continue;
                    }

                    const selects = doc.querySelectorAll('select');
                    collected.push(...Array.from(selects));

                    collected.push(...findSelectsInFrames(frameWin));
                } catch (err) {
                    sendLogtoBack({
                        message: 'Unable to access frame for selects: ' + (err instanceof Error ? err.message : JSON.stringify(err)),
                        level: 'warning',
                    });
                }
            }

            return collected;
        }

        const frameSelects = findSelectsInFrames(window);
        // Filter iframe selects by visibility too
        frameSelects.filter(isVisibleDeep).forEach((select) => {
            results.push(select);
        });
    } catch (error) {
        sendLogtoBack({
            message: 'Error collecting select elements',
            level: 'error',
            object: { error },
        });
    }

    return results;
};

/**
 * Checks if an element is visible (reused from autofillContent logic)
 * Enhanced to check hidden and aria-hidden attributes
 */
const isVisibleDeep = (elem: Element): boolean => {
    // console.log("elem before", elem);
    // if (!(elem instanceof Element)) return false;
    // console.log("elem", elem);
    // Check element's own attributes first (hidden, aria-hidden)
    if (elem.hasAttribute('hidden') || elem.getAttribute('aria-hidden') === 'true') {
        return false;
    }

    const rect = elem.getBoundingClientRect();
    const style = window.getComputedStyle(elem);
    if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        parseFloat(style.opacity) === 0 ||
        !(rect && rect.width > 0 && rect.height > 0)
    )
        return false;

    // Check all ancestors for visibility, hidden attributes, and hidden modals
    let node = elem.parentElement;
    while (node && node !== document.documentElement) {
        // Check ancestor's hidden attributes
        if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        const s = window.getComputedStyle(node);
        if (
            s.display === 'none' ||
            s.visibility === 'hidden' ||
            s.visibility === 'collapse' ||
            parseFloat(s.opacity) === 0
        )
            return false;

        // Check if ancestor is a hidden modal
        const isModal = node.matches?.('[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]');
        if (isModal) {
            // If it's a modal, check if it's hidden via attributes
            if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') {
                return false;
            }

            // Check if modal is hidden via CSS
            const modalRect = node.getBoundingClientRect();
            const modalStyle = window.getComputedStyle(node);
            if (
                modalStyle.display === 'none' ||
                modalStyle.visibility === 'hidden' ||
                parseFloat(modalStyle.opacity) === 0 ||
                !(modalRect && modalRect.width > 0 && modalRect.height > 0)
            ) {
                return false;
            }
        }

        node = node.parentElement;
    }
    return true;
};

/**
 * Gets label text for a select element
 */
const getSelectLabelText = (select: HTMLSelectElement): string => {
    if (select.id) {
        const lab = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
        if (lab && isVisibleDeep(lab)) return (lab as HTMLElement).innerText.trim();
    }
    const wrapper = select.closest('label');
    if (wrapper && isVisibleDeep(wrapper)) {
        const clone = wrapper.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('select, input, textarea').forEach((n) => n.remove());
        if (clone.innerText.trim()) return clone.innerText.trim();
    }
    const ariaLabel = select.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
    return '';
};

/**
 * Classifies select/dropdown elements for registration forms
 */
const classifySelectElement = (select: HTMLSelectElement): string => {
    const label = getSelectLabelText(select).toLowerCase();
    const name = (select.getAttribute('name') || '').toLowerCase();
    const id = (select.getAttribute('id') || '').toLowerCase();
    const ariaLabel = (select.getAttribute('aria-label') || '').toLowerCase();

    const allText = `${label} ${name} ${id} ${ariaLabel}`;

    // Country detection
    if (
        allText.includes('country') ||
        allText.includes('nation') ||
        allText.includes('nationality')
    ) {
        return 'country';
    }

    // State/Province detection
    if (
        allText.includes('state') ||
        allText.includes('province') ||
        allText.includes('region')
    ) {
        return 'state';
    }

    // City detection
    if (allText.includes('city') || allText.includes('town')) {
        return 'city';
    }

    // Gender detection
    if (
        allText.includes('gender') ||
        allText.includes('sex') ||
        allText.includes('title')
    ) {
        return 'gender';
    }

    // Timezone detection
    if (allText.includes('timezone') || allText.includes('time zone')) {
        return 'timezone';
    }

    // Language detection
    if (allText.includes('language') || allText.includes('lang')) {
        return 'language';
    }

    // Currency detection
    if (allText.includes('currency')) {
        return 'currency';
    }

    // Date of Birth detection - check for date, month, year fields
    // Also check parent fieldset/context for DOB indicators
    const parentFieldset = select.closest('fieldset');
    const fieldsetLegend = parentFieldset?.querySelector('legend')?.textContent?.toLowerCase() || '';
    const hasDOBContext = fieldsetLegend.includes('date of birth') || fieldsetLegend.includes('birth') || allText.includes('dob') || allText.includes('date of birth') || allText.includes('birthdate');

    // If we're in a DOB context, classify based on field name/label
    if (hasDOBContext) {
        // Determine specific DOB component - check name first, then label, then allText
        if (name.includes('date') || label.includes('date') || allText.includes('select date')) {
            console.log('[Classification] DOB date field detected:', {
                selectId: select.id,
                selectName: select.name,
                label,
                fieldsetLegend,
            });
            return 'dob-date';
        } else if (name.includes('month') || label.includes('month') || allText.includes('select month')) {
            console.log('[Classification] DOB month field detected:', {
                selectId: select.id,
                selectName: select.name,
                label,
                fieldsetLegend,
            });
            return 'dob-month';
        } else if (name.includes('year') || label.includes('year') || allText.includes('select year')) {
            console.log('[Classification] DOB year field detected:', {
                selectId: select.id,
                selectName: select.name,
                label,
                fieldsetLegend,
            });
            console.log('[Classification] DOB year field - will attempt to fill in autofillRegistrationForm');
            return 'dob-year';
        } else {
            // Generic DOB field
            console.log('[Classification] Generic DOB field detected:', {
                selectId: select.id,
                selectName: select.name,
                label,
                fieldsetLegend,
            });
            return 'dob';
        }
    }

    // Also check for standalone date/month/year fields (not in DOB context but might be DOB)
    if (allText.includes('date') && name.includes('date') && !name.includes('time') && !allText.includes('time')) {
        return 'dob-date';
    } else if ((allText.includes('month') || name.includes('month')) && !allText.includes('time')) {
        return 'dob-month';
    } else if ((allText.includes('year') || name.includes('year')) && !allText.includes('time')) {
        return 'dob-year';
    }

    return 'unknown';
};

/**
 * Finds and selects an option in a select element by value or text
 */
const selectOption = (
    select: HTMLSelectElement,
    value: string
): boolean => {
    if (!value) return false;

    try {
        const valueLower = value.toLowerCase().trim();

        // First, try exact value match
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            const optionValue = (option.value || '').toLowerCase().trim();
            const optionText = (option.text || '').toLowerCase().trim();

            // Exact match on value
            if (optionValue === valueLower) {
                select.selectedIndex = i;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }

            // Exact match on text
            if (optionText === valueLower) {
                select.selectedIndex = i;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }

            const regex1 = new RegExp(`\\b${valueLower}\\b`, 'i');
            const regex2 = new RegExp(`\\b${optionText}\\b`, 'i');
            if (regex1.test(optionText) || regex2.test(valueLower)) {
                select.selectedIndex = i;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        }

        // Matching by country code (e.g., "US" for United States)
        if (value.length === 2 && /^[A-Z]{2}$/i.test(value)) {
            for (let i = 0; i < select.options.length; i++) {
                const option = select.options[i];
                const optionValue = option.value.toUpperCase();
                const optionText = option.text.toUpperCase();

                if (optionValue === value.toUpperCase() || optionText.includes(value.toUpperCase())) {
                    select.selectedIndex = i;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                }
            }
        }
    } catch (error) {
        sendLogtoBack({
            message: 'Error selecting option in dropdown',
            level: 'error',
            object: { error, value },
        });
    }

    return false;
};

/**
 * Classifies input fields specifically for registration forms
 * This is optimized for registration forms where we need to detect:
 * - Name fields (first, last, full, middle, company)
 * - Email, phone, address
 * - Less focus on password fields
 */
const classifyInputV2ForRegistration = (
    item: {
        outerHTMLInput: string | null;
        outerHTMLLabel: string | null;
        outerHTMLAria: string | null;
        input: HTMLInputElement | HTMLTextAreaElement;
    }
): string => {
    const label = (item?.outerHTMLLabel || '').toLowerCase();
    const aria = (item?.outerHTMLAria || '').toLowerCase();
    const placeholder = (item?.input?.getAttribute('placeholder') || '').toLowerCase();
    const name = (item?.input?.getAttribute('name') || '').toLowerCase();
    const id = (item?.input?.getAttribute('id') || '').toLowerCase();
    const type = (item?.input?.getAttribute('type') || '').toLowerCase();
    const className = (item?.input?.getAttribute('class') || '').toLowerCase();
    const role = (item?.input?.getAttribute('role') || '').toLowerCase();

    const allTextOriginal = `${label} ${aria} ${placeholder} ${name} ${id} ${type} ${className} ${role}`;
    const allText = allTextOriginal.toLowerCase();
    console.log("allText", allText);
    console.log("role", role);
    // if (role === '' || role === 'unknown') {
    //     let getparentrole = getRoleFromParentElements(item);
    //     console.log('getparentrole', getparentrole);
    //     return getRoleFromParentElements(item);
    // }
    // Exclude search inputs - return 'unknown' immediately if it's a search field
    if (
        type === 'search' ||
        allText.includes('search') ||
        name.includes('search') ||
        id.includes('search') ||
        className.includes('search') ||
        role === 'search' ||
        placeholder.includes('search')
    ) {
        return 'unknown';
    }

    // Password detection (less priority in registration forms)
    if (type === 'password' || allText.includes('password') || allText.includes('pwd') || allText.includes('pass')) {
        return 'password';
    }

    // Email detection
    if (type === 'email' || allText.includes('email') || allText.includes('e-mail') || allText.includes('mail')) {
        return 'email';
    }

    // Name field detection (more comprehensive for registration)
    if (
        allText.includes('firstname') ||
        allText.includes('first name') ||
        allText.includes('fname') ||
        allText.includes('given name') ||
        allText.includes('forename') && !allText.includes('mother') && !allText.includes('father')
    ) {
        return 'firstname';
    }

    if (
        allText.includes('lastname') ||
        allText.includes('last name') ||
        allText.includes('lname') ||
        allText.includes('surname') ||
        allText.includes('family name') && !allText.includes('mother') && !allText.includes('father')
    ) {
        return 'lastname';
    }

    if (
        allText.includes('fullname') ||
        allText.includes('full name') ||
        allText.includes('your name') ||
        allText.includes('display name') ||
        allText.includes('complete name') && !allText.includes('mother') && !allText.includes('father')
    ) {
        return 'fullname';
    }

    if (
        allText.includes('middlename') ||
        allText.includes('middle name') ||
        allText.includes('mname') && !allText.includes('mother') && !allText.includes('father')
    ) {
        return 'middlename';
    }

    // Phone detection
    if (
        (type === 'tel' ||
            allText.includes('phone') ||
            allText.includes('mobile') ||
            allText.includes('tel') ||
            allText.includes('contact') ||
            allText.includes('number')) && (!allText.includes('account') && !allText.includes('cif') && !allText.includes('branch') && !allText.includes('pan'))
    ) {
        return 'phone';
    }

    if (
        allText.includes('company') ||
        allText.includes('organization') ||
        allText.includes('org') ||
        allText.includes('business')
    ) {
        return 'company';
    }

    // Address detection (but not country/state as they have their own detection)
    if (
        (allText.includes('address') ||
            allText.includes('location') ||
            allText.includes('street') ||
            allText.includes('zip') ||
            allText.includes('postal')) &&
        (!allText.includes('country') &&
            !allText.includes('state') &&
            !allText.includes('city'))
    ) {
        return 'address';
    }

    // City detection (separate from address)
    if (allText.includes('city') || allText.includes('town')) {
        return 'city';
    }

    // Country detection (separate from address)
    if (
        allText.includes('country') ||
        allText.includes('nation') ||
        allText.includes('nationality') || allText.includes('region')
    ) {
        return 'country';
    }

    // State/Province detection (separate from address)
    if (
        allText.includes('state') ||
        allText.includes('province') ||
        allText.includes('region')
    ) {
        return 'state';
    }

    // Date of Birth detection - check autocomplete, type, and labels
    const autocomplete = (item?.input?.getAttribute('autocomplete') || '').toLowerCase();
    const hasBdayAutocomplete = autocomplete === 'bday' || autocomplete === 'birthday';
    const isDateType = type === 'date';
    const hasDOBKeywords =
        allText.includes('dob') ||
        allText.includes('date of birth') ||
        allText.includes('birthdate') ||
        allText.includes('birth date') ||
        allText.includes('birthday') ||
        (allText.includes('birth') && (allText.includes('date') || isDateType));

    if (hasBdayAutocomplete || (isDateType && hasDOBKeywords) || (hasDOBKeywords && !allText.includes('time'))) {
        console.log('[Classification] DOB field detected:', {
            inputId: id,
            inputName: name,
            type,
            autocomplete,
            label,
            hasBdayAutocomplete,
            isDateType,
            hasDOBKeywords,
        });
        return 'dob';
    }

    // Check for Rails-style nested attributes like user[name] or user_name - these are name fields, not usernames
    const hasNestedNamePattern =
        (name.includes('user[') && name.includes(']') && name.includes('name')) ||
        (id.includes('user_') && id.includes('name')) ||
        (name.includes('user_name') || id.includes('user_name'));

    // Generic name field (broader detection for registration)
    // Check this before username to catch nested patterns like user[name]
    if (
        allText.includes('name') &&
        !allText.includes('username') &&
        !allText.includes('email') &&
        !allText.includes('company') &&
        !allText.includes('organization')
    ) {
        return 'name';
    }

    // Username detection (less common in registration, but possible)
    // Exclude nested attribute patterns like user[name] which are name fields
    if (
        !hasNestedNamePattern &&
        (allText.includes('username') ||
            allText.includes('user') || allText.includes('user id') ||
            allText.includes('usr') ||
            allText.includes('login') ||
            allText.includes('account')) &&
        (!allText.includes('number') && !allText.includes('no') && !allText.includes('code') && !allText.includes('date') && !allText.includes('dob') && !allText.includes('image') && !allText.includes('photo') && !allText.includes('captcha'))
    ) {
        return 'username';
    }

    return 'unknown';
};

//detect registration form by its parent element 
const getRoleFromParentElements = (
    item: {
        input: HTMLInputElement | HTMLTextAreaElement;
    }
): string => {
    console.log("item", item);
    let parent = item.input.parentElement;
    console.log("parent", parent);
    // Traverse up to 3 parent elements (adjust depth as needed)
    for (let i = 0; i < 3 && parent; i++) {
        // Check for a label element and its inner span or text
        // If the parent is a form element, return a specific role for form
        if (parent.tagName.toLowerCase() === 'form') {
            console.log('Found parent as a form');
            return 'form';
        }
        const labelElement = parent.querySelector('label');
        let labelText = labelElement ? labelElement.textContent : '';

        // If label text is empty, check if the label contains a span and get the span text
        if (!labelText && labelElement) {
            const spanInLabel = labelElement.querySelector('span');
            labelText = spanInLabel ? spanInLabel.textContent : '';
        }

        // Check if there are other span elements inside the parent (outside label)
        const nestedLabelText = parent.querySelector('span')?.textContent || '';

        // Combine all text to create a broader check (to include both label and span elements)
        const parentText = `${labelText} ${nestedLabelText}`.toLowerCase();

        // Add classes and roles for more context
        const parentClass = parent.getAttribute('class') || '';
        const parentRole = parent.getAttribute('role') || '';

        const fullText = `${parentText} ${parentClass} ${parentRole}`.toLowerCase();
        console.log("fullText", fullText);

        // Check for common fields like email, phone, address, etc.
        if (fullText.includes('email')) {
            return 'email';
        }
        if (fullText.includes('mobile') || fullText.includes('phone')) {
            return 'phone';
        }
        if (fullText.includes('address')) {
            return 'address';
        }
        if (fullText.includes('dob') || fullText.includes('date of birth') || fullText.includes('birthdate') || fullText.includes('birth date')) {
            return 'dob';
        }
        if (fullText.includes('first name')) {
            return 'firstname';
        }
        if (fullText.includes('last name')) {
            return 'lastname';
        }
        if (fullText.includes('name')) {
            return 'name';
        }

        // Move to the next parent level
        parent = parent.parentElement;
    }

    return 'unknown'; // No match found after checking parent elements
};



/**
 * Checks if a string is in email format
 */

/**
 * Checks for registration-related keywords in page content
 * Searches in: title, meta tags, headings, buttons, URL
 */
const checkRegistrationKeywords = (): {
    found: boolean;
    score: number;
    matches: string[];
} => {
    const registrationKeywords = [
        'register',
        'registration',
        'signup',
        'sign up',
        'sign-up',
        'sign-up now',
        'create',
        'create account',
        'create an account',
        'new account',
        'join',
        'sign up now',
        'get started',
        'become a member',
        'open account',
        'apply',
        'application',
        'enroll',
        'enrollment',
        'continue',
        'next',
        'get started'

    ];

    const loginKeywords = [
        'login',
        'log in',
        'sign in',
        'signin',
        'sign-in',
        'logon',
        'log on',
    ];

    let score = 0;
    const matches: string[] = [];

    try {
        // Check page title
        const title = document.title?.toLowerCase() || '';
        registrationKeywords.forEach((keyword) => {
            if (title.includes(keyword)) {
                score += 3; // High weight for title
                matches.push(`title: ${keyword}`);
            }
        });
        loginKeywords.forEach((keyword) => {
            if (title.includes(keyword)) {
                score -= 2; // Negative score for login keywords
            }
        });

        // Check meta description
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content')?.toLowerCase() || '';
        registrationKeywords.forEach((keyword) => {
            if (metaDescription.includes(keyword)) {
                score += 2;
                matches.push(`meta: ${keyword}`);
            }
        });

        // Check URL
        const url = window.location.href.toLowerCase();
        registrationKeywords.forEach((keyword) => {
            if (url.includes(keyword)) {
                score += 2;
                matches.push(`url: ${keyword}`);
            }
        });
        loginKeywords.forEach((keyword) => {
            if (url.includes(keyword)) {
                score -= 1;
            }
        });

        // Check headings (h1, h2, h3)
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4,h5,h6'));
        headings.forEach((heading) => {
            const text = heading.textContent?.toLowerCase() || '';
            registrationKeywords.forEach((keyword) => {
                if (text.includes(keyword)) {
                    score += 2;
                    matches.push(`heading: ${keyword}`);
                }
            });
        });

        // Check button text (common registration button labels)
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'));
        buttons.forEach((button) => {
            const text = button.textContent?.toLowerCase() || button.getAttribute('value')?.toLowerCase() || '';
            registrationKeywords.forEach((keyword) => {
                if (text.includes(keyword)) {
                    score += 1.5;
                    matches.push(`button: ${keyword}`);
                }
            });
        });

        // Check form labels and legends
        const labels = Array.from(document.querySelectorAll('label, legend'));
        labels.forEach((label) => {
            const text = label.textContent?.toLowerCase() || '';
            registrationKeywords.forEach((keyword) => {
                if (text.includes(keyword)) {
                    score += 1;
                    matches.push(`label: ${keyword}`);
                }
            });
        });

        // Check for common registration form indicators in page text
        const bodyText = document.body?.textContent?.toLowerCase() || '';
        const registrationPhrases = [
            'create your account',
            'register now',
            'sign up for',
            'new user registration',
            'account registration',
        ];
        registrationPhrases.forEach((phrase) => {
            if (bodyText.includes(phrase)) {
                score += 1;
                matches.push(`text: ${phrase}`);
            }
        });
    } catch (error) {
        sendLogtoBack({
            message: 'Error checking registration keywords',
            level: 'error',
            object: { error },
        });
    }

    return {
        found: score > 0,
        score,
        matches: [...new Set(matches)],
    };
};

/**
 * Detects if the current page is a registration form
 * A registration form typically has:
 * - Name, email, phone, address fields
 * - NO password field (or password is optional/confirmation)
 * - Multiple personal information fields
 * - Registration-related keywords in page content
 */
export const detectRegistrationForm = (): boolean => {
    try {
        console.log('[AutofillFlow] detectRegistrationForm start');
        // Clean up stale entries before checking (elements no longer in DOM or hidden)
        // This ensures we're working with current, visible fields only
        // const validInputData = inputDataWithElement.filter((item) => {
        // if (!document.contains(item.input)) {
        //     return false;
        // }
        // return isVisibleDeep(item.input);
        // });
        // console.log("validInputData", validInputData);
        // console.log('inputDataWithElement (before filter):', inputDataWithElement.length, 'valid:', validInputData.length);
        console.log("inputDataWithElement", inputDataWithElement);
        const requiredFields = inputDataWithElement.filter((item) => {
            // First check if element is still in DOM
            // if (!document.contains(item.input)) {
            //     return false;
            // }

            // Exclude hidden fields (including those in hidden modals)
            // This checks the element itself and all ancestors for hidden state
            // if (!isVisibleDeep(item.input)) {
            //     sendLogtoBack({
            //         message: 'Filtering out hidden field from registration detection',
            //         level: 'info',
            //         object: {
            //             inputId: item.input.id,
            //             inputName: item.input.name,
            //             inputType: item.input.type || item.input.tagName,
            //         },
            //     });
            //     return false;
            // }
            let role = classifyInputV2ForRegistration(item);
            console.log("role", role);
            if (role === '' || role === 'unknown') {
                let getparentrole = getRoleFromParentElements(item);
                console.log("item", item);
                console.log('getparentrole', getparentrole);
                role = getRoleFromParentElements(item);
            }
            return role !== 'unknown';
        });

        // Also check select elements for registration form indicators
        const selectElements = collectSelectElements();
        const selectFields = selectElements
            .filter((select) => isVisibleDeep(select)) // Filter by visibility
            .map((select) => {
                const role = classifySelectElement(select);
                return role !== 'unknown' ? { element: select, role } : null;
            })
            .filter((item): item is { element: HTMLSelectElement; role: string } => item !== null);
        console.log('selectFields', selectFields);
        console.log('requiredFields', requiredFields);
        if (requiredFields.length === 0) {
            return false;
        }

        // Check for password field
        const hasPassword = requiredFields.some((item) => {
            const role = classifyInputV2ForRegistration(item);
            return role === 'password';
        });
        console.log('hasPassword', hasPassword);
        // Check for personal info fields (name, email, phone, address)
        // Include all name variants for registration forms
        const personalInfoRoles = [
            'username',
            'email',
            'phone',
            'address',
            'name',
            'firstname',
            'lastname',
            'fullname',
            'middlename',
            'company',
            'country',
            'state',
            'city',
            'gender',
        ];
        const hasPersonalInfoFields =
            requiredFields.some((item) => {
                let role = classifyInputV2ForRegistration(item);
                if (role === '' || role === 'unknown') {
                    let getparentrole = getRoleFromParentElements(item);
                    console.log('getparentrole', getparentrole);
                    role = getRoleFromParentElements(item);
                }
                return personalInfoRoles.includes(role);
            }) ||
            selectFields.some((item) => {
                return personalInfoRoles.includes(item.role);
            });
        console.log('hasPersonalInfoFields', hasPersonalInfoFields);
        // Count personal info fields (including all name variants and select elements)
        const personalInfoCount =
            requiredFields.filter((item) => {
                let role = classifyInputV2ForRegistration(item);
                if (role === '' || role === 'unknown') {
                    let getparentrole = getRoleFromParentElements(item);
                    console.log('getparentrole', getparentrole);
                    role = getRoleFromParentElements(item);
                }
                return personalInfoRoles.includes(role);
            }).length +
            selectFields.filter((item) => {
                return personalInfoRoles.includes(item.role);
            }).length;
        console.log('personalInfoCount', personalInfoCount);
        // Check for registration keywords in page content
        const keywordCheck = checkRegistrationKeywords();
        console.log('keywordCheck', keywordCheck);
        // Combine form field analysis with keyword detection
        // If keywords are found, lower the threshold for field requirements
        const hasStrongKeywordSignal = keywordCheck.score >= 2.5;

        // Registration form criteria:
        // 1. Has personal info fields (name, email, phone, etc.)
        // 2. Has at least 2 personal info fields (or 1 if strong keyword signal)
        // 3. Either no password OR (password exists but strong keyword signal)
        // 4. Keyword check provides additional confidence
        const minFieldCount = hasStrongKeywordSignal ? 1 : 2;
        const isRegistrationForm =
            hasPersonalInfoFields &&
            personalInfoCount >= minFieldCount &&
            (!hasPassword || hasStrongKeywordSignal || personalInfoCount >= 2);
        console.log(" personalInfoCount >= minFieldCount", personalInfoCount >= minFieldCount);
        console.log(' (!hasPassword || hasStrongKeywordSignal || personalInfoCount >= 2)', (!hasPassword || hasStrongKeywordSignal || personalInfoCount >= 2));
        sendLogtoBack({
            message: `Registration form detection: ${isRegistrationForm ? 'YES' : 'NO'}`,
            level: 'info',
            object: {
                hasPassword,
                hasPersonalInfoFields,
                personalInfoCount,
                totalFields: requiredFields.length,
                keywordScore: keywordCheck.score,
                keywordMatches: keywordCheck.matches,
                hasStrongKeywordSignal,
            },
        });

        console.log('[AutofillFlow] detectRegistrationForm result', {
            isRegistrationForm,
            hasPassword,
            hasPersonalInfoFields,
            personalInfoCount,
            keywordScore: keywordCheck.score,
        });
        return isRegistrationForm;
    } catch (error) {
        console.log('error', error);
        sendLogtoBack({
            message: 'Error in detectRegistrationForm',
            level: 'error',
            object: { error },
        });
        return false;
    }
};

/**
 * Checks if the current URL has saved credentials
 */
export const hasCredentialsForUrl = async (
    credentialsData: CredentialsV1[] | null,
    currentUrl: string
): Promise<boolean> => {
    if (!credentialsData || credentialsData.length === 0) {
        return false;
    }

    try {
        const foundCreds = await findCredentialsByDomain(credentialsData, currentUrl);
        return foundCreds && foundCreds.length > 0;
    } catch (error) {
        sendLogtoBack({
            message: 'Error checking credentials for URL',
            level: 'error',
            object: { error },
        });
        return false;
    }
};

/**
 * Decrypts personal info data
 */
export const decryptPersonalInfo = (
    personalInfo: PersonalInfoV1 | null,
    pass: string
): personalInfoFields_v1 | null => {
    if (!personalInfo || !pass) {
        return null;
    }

    try {
        const removespace = personalInfo.data.replace(/\s/g, '');
        const decrypted = CryptoJS.AES.decrypt(removespace, pass).toString(CryptoJS.enc.Utf8);

        if (decrypted && decrypted !== 'error') {
            return JSON.parse(decrypted) as personalInfoFields_v1;
        }
    } catch (error) {
        sendLogtoBack({
            message: 'Error decrypting personal info',
            level: 'error',
            object: { error },
        });
    }

    return null;
};


/**
 * Detects the specific type of name field (first name, last name, full name, company, etc.)
 */
const detectNameFieldType = (item: {
    outerHTMLInput: string | null;
    outerHTMLLabel: string | null;
    outerHTMLAria: string | null;
    input: HTMLInputElement | HTMLTextAreaElement;
}): string | null => {
    const label = (item?.outerHTMLLabel || '').toLowerCase();
    const aria = (item?.outerHTMLAria || '').toLowerCase();
    const placeholder = (item?.input?.getAttribute('placeholder') || '').toLowerCase();
    const name = (item?.input?.getAttribute('name') || '').toLowerCase();
    const id = (item?.input?.getAttribute('id') || '').toLowerCase();

    const allText = `${label} ${aria} ${placeholder} ${name} ${id}`;

    if (
        allText.includes('search')
    ) {
        return 'unknown';
    }

    // Check for specific name types in order of specificity
    if (
        allText.includes('company') ||
        allText.includes('organization') ||
        allText.includes('org') ||
        allText.includes('business')
    ) {
        return 'company';
    }

    if (
        allText.includes('firstname') ||
        allText.includes('first name') ||
        allText.includes('fname') ||
        allText.includes('given name') ||
        allText.includes('forename')
    ) {
        return 'firstname';
    }

    if (
        allText.includes('lastname') ||
        allText.includes('last name') ||
        allText.includes('lname') ||
        allText.includes('surname') ||
        allText.includes('family name')
    ) {
        return 'lastname';
    }

    if (
        allText.includes('fullname') ||
        allText.includes('full name') ||
        allText.includes('display name') ||
        allText.includes('complete name')
    ) {
        return 'fullname';
    }

    if (
        allText.includes('middlename') ||
        allText.includes('middle name') ||
        allText.includes('mname')
    ) {
        return 'middlename';
    }

    // Generic name field (only if no specific type found)
    if (
        allText.includes('name') &&
        !allText.includes('username') &&
        !allText.includes('email') &&
        !allText.includes('company') &&
        !allText.includes('organization')
    ) {
        return 'name';
    }

    return null;
};

/**
 * Parses full name into first and last name
 */
const parseFullName = (fullName: string): { firstName: string; lastName: string } => {
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: '', lastName: '' };
    }

    const trimmed = fullName.trim();
    const parts = trimmed.split(/\s+/);

    if (parts.length === 0) {
        return { firstName: '', lastName: '' };
    }

    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }

    // First name is first part, last name is everything else
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    return { firstName, lastName };
};

/**
 * Checks if a role's data exists in personalInfo
 */
const hasDataForRole = (role: string, personalInfo: personalInfoFields_v1, firstName: string, lastName: string): boolean => {
    console.log('[hasDataForRole] Checking role:', role);
    if (role === 'unknown') {
        console.log('[hasDataForRole] Role is unknown, returning false');
        return false;
    }

    // Map role to personal info value
    if (role === 'firstname' || role === 'firstName') {
        return !!(firstName || personalInfo.additionalFields?.firstname || personalInfo.additionalFields?.firstName);
    } else if (role === 'lastname' || role === 'lastName') {
        return !!(lastName || personalInfo.additionalFields?.lastname || personalInfo.additionalFields?.lastName);
    } else if (role === 'fullname' || role === 'name') {
        return !!(personalInfo.name || firstName || lastName);
    } else if (role === 'middlename') {
        return !!(personalInfo.additionalFields?.middlename || personalInfo.additionalFields?.middleName);
    } else if (role === 'company') {
        return !!(personalInfo.additionalFields?.company || personalInfo.additionalFields?.companyName || personalInfo.additionalFields?.organization);
    } else if (role === 'email') {
        return !!personalInfo.email;
    } else if (role === 'phone') {
        return !!personalInfo.phone;
    } else if (role === 'address') {
        return !!personalInfo.additionalFields?.address;
    } else if (role === 'country') {
        return !!(personalInfo.additionalFields?.country || personalInfo.additionalFields?.countryName || personalInfo.additionalFields?.nationality);
    } else if (role === 'state') {
        return !!(personalInfo.additionalFields?.state || personalInfo.additionalFields?.stateName || personalInfo.additionalFields?.province || personalInfo.additionalFields?.region);
    } else if (role === 'city') {
        return !!(personalInfo.additionalFields?.city || personalInfo.additionalFields?.cityName || personalInfo.additionalFields?.town);
    } else if (role === 'gender') {
        return !!(personalInfo.additionalFields?.gender || personalInfo.additionalFields?.sex || personalInfo.additionalFields?.title);
    } else if (role === 'timezone') {
        return !!personalInfo.additionalFields?.timezone;
    } else if (role === 'language') {
        return !!(personalInfo.additionalFields?.language || personalInfo.additionalFields?.lang);
    } else if (role === 'currency') {
        return !!personalInfo.additionalFields?.currency;
    } else if (role === 'username') {
        return !!personalInfo.additionalFields?.username;
    } else if (role === 'dob' || role === 'dateofbirth' || role === 'birthdate' || role === 'dob-date' || role === 'dob-month' || role === 'dob-year') {
        // For split DOB fields (date, month, year), check if DOB exists
        // Check both personalInfo.dob and additionalFields.DOB (case-insensitive)
        const dobFromMain = personalInfo.dob;
        const additionalFields = personalInfo.additionalFields || {};
        const dobFromAdditional = additionalFields.dob || additionalFields.DOB || additionalFields.Dob || additionalFields.dateOfBirth || additionalFields.dateofbirth;
        const hasDOB = !!(dobFromMain || dobFromAdditional);
        console.log('[hasDataForRole] DOB check:', {
            role,
            hasDOB,
            dobFromMain,
            dobFromAdditional,
            dobValue: dobFromMain || dobFromAdditional,
            dobType: typeof (dobFromMain || dobFromAdditional),
        });
        return hasDOB;
    } else {
        // Check additionalFields for custom fields (case-insensitive)
        const roleLower = role.toLowerCase();
        return !!(
            personalInfo.additionalFields?.[role] ||
            personalInfo.additionalFields?.[roleLower] ||
            personalInfo.additionalFields?.[roleLower.charAt(0).toUpperCase() + roleLower.slice(1)]
        );
    }
};

/**
 * Validates unfilled fields before passing to AI
 * Returns true if all unfilled fields are valid (not search/password and have data in personalInfo)
 */
const validateUnfilledFields = (
    filled: string[],
    inputDataWithElement: Array<{
        outerHTMLInput: string | null;
        outerHTMLLabel: string | null;
        outerHTMLAria: string | null;
        input: HTMLInputElement | HTMLTextAreaElement;
    }>,
    selectElements: HTMLSelectElement[],
    personalInfo: personalInfoFields_v1,
    firstName: string,
    lastName: string
): { isValid: boolean; reason?: string; missingFields?: string[] } => {
    console.log('[Validation] ===== STARTING VALIDATION =====', personalInfo);
    console.log('[Validation] Input:', {
        filledRoles: filled,
        inputCount: inputDataWithElement.length,
        selectCount: selectElements.length,
        hasDOB: !!personalInfo?.additionalFields?.dob,
        personalInfoKeys: Object.keys(personalInfo),
    });

    const missingFields: string[] = [];
    const fieldsWithData: string[] = [];
    let skippedPasswordFieldsCount = 0;
    let unfilledNonPasswordFieldsCount = 0;
    let unfilledSelectsCount = 0;
    let unknownFieldsCount = 0;

    console.log('[Validation] Checking unfilled inputs...');
    // Check unfilled inputs
    for (const item of inputDataWithElement) {
        const input = item.input as HTMLInputElement;
        const type = (input.getAttribute('type') || '').toLowerCase();
        const name = (input.getAttribute('name') || '').toLowerCase();
        const label = (item.outerHTMLLabel || '').toLowerCase();
        const allText = `${label} ${name} ${type}`.toLowerCase();

        // Check if this field is actually unfilled (not already filled)
        const isFilled = input.value && input.value.trim() !== '';

        // Skip search and password fields
        if (
            type === 'search' ||
            type === 'password' ||
            allText.includes('search') ||
            name.includes('search')
        ) {
            if (!isFilled) {
                skippedPasswordFieldsCount++;
            }
            console.log('[Validation] Skipping input (search/password):', {
                inputId: input.id,
                inputName: input.name,
                type,
                isFilled,
            });
            continue;
        }

        // Skip if already filled (by value)
        if (isFilled) {
            console.log('[Validation] Skipping input (already filled by value):', {
                inputId: input.id,
                inputName: input.name,
            });
            continue;
        }

        // Get role for this input
        let role = classifyInputV2ForRegistration(item);
        console.log('[Validation] Input initial role:', {
            inputId: input.id,
            inputName: input.name,
            role,
        });

        if (role === 'unknown') {
            const nameFieldType = detectNameFieldType(item);
            if (nameFieldType && nameFieldType !== 'unknown') {
                role = nameFieldType;
                console.log('[Validation] Input role from detectNameFieldType:', {
                    inputId: input.id,
                    role,
                });
            } else {
                role = getRoleFromParentElements(item);
                console.log('[Validation] Input role from getRoleFromParentElements:', {
                    inputId: input.id,
                    role,
                });
            }
        }

        // Skip if already filled (by role in filled array)
        if (filled.includes(role)) {
            console.log('[Validation] Skipping input (already filled by role):', {
                inputId: input.id,
                role,
                inFilledArray: true,
            });
            continue;
        }

        // Track ALL unfilled non-password fields (even if unknown or have data)
        // This ensures we call AI if there are any other fields besides passwords
        unfilledNonPasswordFieldsCount++;
        console.log('[Validation] Found unfilled non-password field:', {
            inputId: input.id,
            inputName: input.name,
            role,
            totalUnfilledNonPassword: unfilledNonPasswordFieldsCount,
        });

        // Skip unknown fields for data checking, but still count them
        if (role === 'unknown') {
            unknownFieldsCount++;
            console.log('[Validation] Input has unknown role (counted but skipping data check):', {
                inputId: input.id,
                role,
                unknownFieldsCount,
            });
            continue;
        }

        // Check if data exists in personalInfo
        const hasData = hasDataForRole(role, personalInfo, firstName, lastName);
        console.log('[Validation] Checking data for input:', {
            inputId: input.id,
            inputName: input.name,
            role,
            hasData,
        });

        if (!hasData) {
            missingFields.push(role);
            console.log('[Validation] ❌ Missing data for input field:', {
                role,
                inputId: input.id,
                inputName: input.name,
                inputType: type,
                label,
                inFilledArray: filled.includes(role),
            });
        } else {
            fieldsWithData.push(role);
            console.log('[Validation] ✅ Input has data:', {
                role,
                inputId: input.id,
            });
        }
    }

    console.log('[Validation] Checking unfilled selects...');
    // Check unfilled selects
    for (const select of selectElements) {
        const role = classifySelectElement(select);
        console.log('[Validation] Select classified role:', {
            selectId: select.id,
            selectName: select.name,
            role,
        });

        // Check if select actually has a value selected (not just default empty option)
        const hasValue = select.value && select.value !== '' && select.selectedIndex > 0;
        console.log('[Validation] Select value check:', {
            selectId: select.id,
            selectValue: select.value,
            selectedIndex: select.selectedIndex,
            hasValue,
        });

        // Skip if already filled (in filled array OR has a value selected)
        if (filled.includes(role)) {
            console.log('[Validation] Skipping select (already filled by role):', {
                selectId: select.id,
                role,
                inFilledArray: true,
            });
            continue;
        }

        if (hasValue) {
            console.log('[Validation] Skipping select (already filled by value):', {
                selectId: select.id,
                role,
                value: select.value,
            });
            continue;
        }

        // Track ALL unfilled selects (even if unknown or have data)
        // This ensures we call AI if there are any select fields besides passwords
        unfilledSelectsCount++;
        console.log('[Validation] Found unfilled select:', {
            selectId: select.id,
            selectName: select.name,
            role,
            totalUnfilledSelects: unfilledSelectsCount,
        });

        // Skip unknown fields for data checking, but still count them
        if (role === 'unknown') {
            unknownFieldsCount++;
            console.log('[Validation] Select has unknown role (counted but skipping data check):', {
                selectId: select.id,
                role,
                unknownFieldsCount,
            });
            continue;
        }

        // Check if data exists in personalInfo
        const hasData = hasDataForRole(role, personalInfo, firstName, lastName);
        console.log('[Validation] Checking data for select:', {
            selectId: select.id,
            selectName: select.name,
            role,
            hasData,
        });

        if (!hasData) {
            missingFields.push(role);
            console.log('[Validation] ❌ Missing data for select field:', {
                role,
                selectId: select.id,
                selectName: select.name,
                label: getSelectLabelText(select),
                hasValue,
                inFilledArray: filled.includes(role),
            });
        } else {
            fieldsWithData.push(role);
            console.log('[Validation] ✅ Select has data:', {
                role,
                selectId: select.id,
            });
        }
    }

    console.log('[Validation] ===== VALIDATION SUMMARY =====');
    console.log('[Validation] Missing fields count:', missingFields.length);
    console.log('[Validation] Missing fields:', missingFields);
    console.log('[Validation] Fields with data count:', fieldsWithData.length);
    console.log('[Validation] Fields with data:', fieldsWithData);
    console.log('[Validation] Unknown fields count:', unknownFieldsCount);
    console.log('[Validation] Skipped password/search fields count:', skippedPasswordFieldsCount);
    console.log('[Validation] Unfilled non-password fields count:', unfilledNonPasswordFieldsCount);
    console.log('[Validation] Unfilled selects count:', unfilledSelectsCount);

    // Calculate total unfilled non-password fields (excluding unknown fields that don't have data)
    // We only care about fields we can actually fill with data from personalInfo
    const totalUnfilledFieldsWithPotentialData = unfilledNonPasswordFieldsCount + unfilledSelectsCount;
    const onlyPasswordFieldsRemain = skippedPasswordFieldsCount > 0 && totalUnfilledFieldsWithPotentialData === 0;

    // Block AI if only password/search fields remain
    if (onlyPasswordFieldsRemain) {
        console.log('[Validation] ❌ VALIDATION FAILED - Only password/search fields remain unfilled, AI should not be called');
        console.log('[Validation] Reason: Password fields should be handled separately, not by AI autofill');
        console.log('[Validation] Details:', {
            skippedPasswordFieldsCount,
            unfilledNonPasswordFieldsCount,
            unfilledSelectsCount,
            totalUnfilledFieldsWithPotentialData,
        });
        return {
            isValid: false,
            reason: 'Only password/search fields remain unfilled, which should be handled separately',
            missingFields: [],
        };
    }

    // Only call AI if we have data in personalInfo for at least one unfilled field
    // Don't call AI if only unknown fields remain (verification codes, etc.) - we don't have data for them
    if (totalUnfilledFieldsWithPotentialData > 0) {
        if (fieldsWithData.length > 0) {
            console.log('[Validation] ✅ Unfilled fields detected with data in personalInfo - allowing AI');
            console.log('[Validation] Details:', {
                skippedPasswordFieldsCount,
                unfilledNonPasswordFieldsCount,
                unfilledSelectsCount,
                fieldsWithDataCount: fieldsWithData.length,
                fieldsWithData,
                unknownFieldsCount,
                missingFieldsCount: missingFields.length,
                missingFields,
            });
            return { isValid: true };
        } else {
            console.log('[Validation] ❌ VALIDATION FAILED - Unfilled fields exist but no data in personalInfo for any of them');
            console.log('[Validation] Reason: No data in personalInfo for unfilled fields (including unknown fields like verification codes)');
            console.log('[Validation] Details:', {
                skippedPasswordFieldsCount,
                unfilledNonPasswordFieldsCount,
                unfilledSelectsCount,
                fieldsWithDataCount: fieldsWithData.length,
                unknownFieldsCount,
                missingFieldsCount: missingFields.length,
                missingFields,
            });
            return {
                isValid: false,
                reason: 'Unfilled fields exist but no data in personalInfo for any of them',
                missingFields,
            };
        }
    }

    // If no unfilled fields at all, allow (edge case)
    console.log('[Validation] ✅ VALIDATION PASSED - No unfilled fields to process');
    return { isValid: true };
};

/**
 * Autofills registration form with personal information
 */




export const autofillRegistrationForm = (
    personalInfo: personalInfoFields_v1
): { filled: string[]; success: boolean; aiPromise?: Promise<{ filled: string[]; success: boolean }> } => {
    try {
        console.log('[AutofillFlow] autofillRegistrationForm start', {
            hasName: !!personalInfo?.name,
            hasEmail: !!personalInfo?.email,
            hasPhone: !!personalInfo?.phone,
            hasDob: !!personalInfo?.dob,
            additionalKeys: Object.keys(personalInfo?.additionalFields || {}),
        });
        console.log("inputDataWithElement in autofillRegistrationForm", inputDataWithElement);
        const filled: string[] = [];

        if (!inputDataWithElement || inputDataWithElement.length === 0) {
            console.log('[AutofillFlow] No inputDataWithElement found');
            sendLogtoBack({
                message: 'No input fields found for registration autofill',
                level: 'error',
            });
            return { filled: [], success: false };
        }

        // Parse full name once for reuse
        const { firstName, lastName } = parseFullName(personalInfo.name || '');
        console.log("firstName, lastName in autofillRegistrationForm", firstName, lastName);
        // Collect and process select/dropdown elements
        const selectElements = collectSelectElements();
        console.log('[AutofillFlow] selectElements count', selectElements.length);
        selectElements.forEach((select) => {
            const role = classifySelectElement(select);
            console.log("role", role);
            if (role === 'unknown') return;

            let value: string | null = null;

            // Map role to personal info value
            if (role === 'country') {
                value =
                    personalInfo.additionalFields?.country ||
                    personalInfo.additionalFields?.countryName ||
                    personalInfo.additionalFields?.nationality ||
                    null;
            } else if (role === 'state') {
                value =
                    personalInfo.additionalFields?.state ||
                    personalInfo.additionalFields?.stateName ||
                    personalInfo.additionalFields?.province ||
                    personalInfo.additionalFields?.region ||
                    null;
            } else if (role === 'city') {
                value =
                    personalInfo.additionalFields?.city ||
                    personalInfo.additionalFields?.cityName ||
                    personalInfo.additionalFields?.town ||
                    null;
            } else if (role === 'gender') {
                value =
                    personalInfo.additionalFields?.gender ||
                    personalInfo.additionalFields?.sex ||
                    personalInfo.additionalFields?.title ||
                    null;
            } else if (role === 'timezone') {
                value = personalInfo.additionalFields?.timezone || null;
            } else if (role === 'language') {
                value = personalInfo.additionalFields?.language || personalInfo.additionalFields?.lang || null;
            } else if (role === 'currency') {
                value = personalInfo.additionalFields?.currency || null;
            } else if (role === 'dob-date' || role === 'dob-month' || role === 'dob-year' || role === 'dob') {
                // Handle DOB fields - parse the DOB and extract the appropriate component
                // Check both personalInfo.dob and additionalFields.DOB (case-insensitive)
                const dobFromMain = personalInfo.dob;
                const additionalFields = personalInfo.additionalFields || {};
                const dobFromAdditional = additionalFields.dob || additionalFields.DOB || additionalFields.Dob || additionalFields.dateOfBirth || additionalFields.dateofbirth;
                const dobValue = dobFromMain || dobFromAdditional;
                console.log('[Autofill] Processing DOB field:', {
                    role,
                    selectId: select.id,
                    selectName: select.name,
                    hasDOB: !!dobValue,
                    dobValue,
                    dobFromMain,
                    dobFromAdditional,
                });

            }
            else {
                // Try to find in additionalFields by role name
                value = personalInfo.additionalFields?.[role] || null;
            }

            if (value) {
                console.log('[Autofill] Attempting to fill select:', {
                    role,
                    value,
                    selectId: select.id,
                    selectName: select.name,
                });
                const success = selectOption(select, value);
                if (success) {
                    (select as HTMLElement).style.outline = '2px solid #3b82f6';
                    (select as HTMLElement).style.borderColor = '#3b82f6';
                    filled.push(role);
                    console.log('[Autofill] ✅ Successfully filled select:', {
                        role,
                        value,
                        filledArray: filled,
                    });

                    sendLogtoBack({
                        message: `Filled ${role} dropdown with value: ${value}`,
                        level: 'info',
                        object: { role, value },
                    });
                } else {
                    console.log('[Autofill] ❌ Failed to fill select - value not found in options:', {
                        role,
                        value,
                        selectId: select.id,
                        selectName: select.name,
                        optionsCount: select.options.length,
                        firstFewOptions: Array.from(select.options).slice(0, 5).map(opt => ({ value: opt.value, text: opt.text })),
                    });
                    sendLogtoBack({
                        message: `Could not find matching option for ${role} dropdown`,
                        level: 'warning',
                        object: { role, value, optionsCount: select.options.length },
                    });
                }
            } else {
                console.log('[Autofill] ⚠️ No value to fill for select:', {
                    role,
                    selectId: select.id,
                    selectName: select.name,
                });
            }
        });

        // Process input and textarea elements
        inputDataWithElement.forEach((item) => {
            // Use registration-specific classification
            let role = classifyInputV2ForRegistration(item);

            // If role is still unknown, try the name field type detector as fallback
            if (role === 'unknown') {

                const nameFieldType = detectNameFieldType(item);
                if (nameFieldType) {
                    role = nameFieldType;
                }
                role = getRoleFromParentElements(item);
                console.log("rolefrom parent elements", role);
            }

            let value: string | null = null;

            // Map role to personal info value with specific name field handling
            if (role === 'firstname') {
                value = firstName || personalInfo.additionalFields?.firstname || personalInfo.additionalFields?.firstName || null;
            } else if (role === 'lastname') {
                value = lastName || personalInfo.additionalFields?.lastname || personalInfo.additionalFields?.lastName || null;
            } else if (role === 'fullname') {
                value = personalInfo.name || null;
            } else if (role === 'middlename') {
                value = personalInfo.additionalFields?.middlename || personalInfo.additionalFields?.middleName || null;
            } else if (role === 'company') {
                value = personalInfo.additionalFields?.company || personalInfo.additionalFields?.companyName || personalInfo.additionalFields?.organization || null;
            } else if (role === 'name') {
                // Generic name field - use full name if available, otherwise try first name
                value = personalInfo.name || firstName || null;
            } else if (role === 'email') {
                value = personalInfo.email || null;
            } else if (role === 'phone') {
                value = personalInfo.phone || null;
            } else if (role === 'address') {
                value = personalInfo.additionalFields?.address || null;
            } else if (role === 'country') {
                value =
                    personalInfo.additionalFields?.country ||
                    personalInfo.additionalFields?.countryName ||
                    personalInfo.additionalFields?.nationality ||
                    null;
            } else if (role === 'state') {
                value =
                    personalInfo.additionalFields?.state ||
                    personalInfo.additionalFields?.stateName ||
                    personalInfo.additionalFields?.province ||
                    personalInfo.additionalFields?.region ||
                    null;
            } else if (role === 'city') {
                value =
                    personalInfo.additionalFields?.city ||
                    personalInfo.additionalFields?.cityName ||
                    personalInfo.additionalFields?.town ||
                    null;
            } else if (role === 'username') {
                value = personalInfo.additionalFields?.username || null;
            } else if (role !== 'unknown') {
                // Check additionalFields for custom fields (case-insensitive)
                const roleLower = role.toLowerCase();
                value =
                    personalInfo.additionalFields?.[role] ||
                    personalInfo.additionalFields?.[roleLower] ||
                    // Try camelCase version
                    personalInfo.additionalFields?.[roleLower.charAt(0).toUpperCase() + roleLower.slice(1)] ||
                    null;
            }
            console.log("value", value);
            // if (!value) {
            //     value = getFieldValueFromParent(item, personalInfo);
            // }


            if (value) {
                try {
                    setTimeout(() => {
                        (item.input as HTMLInputElement).value = value;

                    }, 1000);
                    console.log("value", value);
                    console.log("item.input", item.input);
                    if (!(item.input as HTMLInputElement).value && role !== 'unknown') {
                        const inputId = item.input.id; // Get the input's id
                        console.log(`Input ID: ${inputId}`);

                        // Get the parent element of the input, assuming it's a direct parent
                        const parentElement = item.input.parentElement;
                        console.log("parentElement", parentElement);
                        if (parentElement) {
                            // Find the index of the input element in its parent
                            const inputs = Array.from(parentElement.getElementsByTagName('input'));
                            const inputIndex = inputs.indexOf(item.input as HTMLInputElement);
                            console.log("inputIndex", inputIndex);
                            console.log("inputs", inputs);
                            if (inputIndex >= 0) {
                                console.log(`Found input at index: ${inputIndex}`);

                                // Get the specific input element by index
                                const inputElement = inputs[inputIndex];
                                console.log("inputElement", inputElement);

                                // Check if the element exists and is an HTMLInputElement
                                if (inputElement) {
                                    // Function to simulate typing each character in the value
                                    function simulateTyping(value: string) {
                                        let index = 0;

                                        function typeNextChar() {
                                            if (index < value.length) {
                                                // Simulate key press for each character
                                                const char = value[index];

                                                // Set the value character by character
                                                inputElement.value = inputElement.value + char; // Append char to current value
                                                inputElement.dispatchEvent(new Event('focus', { bubbles: true }));

                                                // Dispatch the 'input' event for React to update its state
                                                const inputEvent = new Event('input', { bubbles: true });
                                                inputElement.dispatchEvent(inputEvent);

                                                // Move to the next character after a small delay
                                                index++;
                                                setTimeout(typeNextChar, 1);
                                            }
                                        }

                                        typeNextChar(); // Start simulating typing
                                    }

                                    // Set the value via simulated typing
                                    simulateTyping(value);

                                    // Optionally, you can dispatch 'focus' and 'blur' events if needed
                                    setTimeout(() => {
                                        inputElement.dispatchEvent(new Event('focus', { bubbles: true }));
                                        inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
                                    }, value.length * 50); // Ensure this is after typing completes
                                } else {
                                    console.error(`Element with id "${inputId}" not found.`);
                                }
                            } else {
                                console.error(`Input element not found at the specified index.`);
                            }
                        } else {
                            console.error('Parent element not found.');
                        }
                    }




                    item.input.dispatchEvent(new Event('input', { bubbles: true }));
                    item.input.dispatchEvent(new Event('change', { bubbles: true }));
                    (item.input as HTMLElement).style.outline = '2px solid #3b82f6';
                    (item.input as HTMLElement).style.borderColor = '#3b82f6';

                    filled.push(role);

                    sendLogtoBack({
                        message: `Filled ${role} field with value`,
                        level: 'info',
                        object: { role, hasValue: !!value },
                    });
                } catch (error) {
                    sendLogtoBack({
                        message: 'Error filling field in registration form',
                        level: 'error',
                        object: { error, role },
                    });
                }
            }
        });

        sendLogtoBack({
            message: `Registration form autofilled: ${filled.length} fields`,
            level: filled.length > 0 ? 'success' : 'warning',
            object: { filled },
        });
        const discoveredInputs = inputDataWithElement?.length || 0;
        const discoveredSelects = selectElements?.length || 0;

        const discoveredTotal = discoveredInputs + discoveredSelects;
        const filledCount = filled.length;

        console.log('[Autofill] ===== CHECKING IF AI SHOULD BE CALLED =====');
        console.log('[Autofill] Discovery summary:', {
            discoveredTotal,
            filledCount,
            discoveredInputs,
            discoveredSelects,
            filledRoles: filled,
        });

        if (discoveredTotal > filledCount) {
            console.log('[Autofill] ✅ Condition met: discoveredTotal > filledCount');
            console.log('[Autofill] Pre-validation check:', {
                discoveredTotal,
                filledCount,
                notFilledCount: discoveredTotal - filledCount,
                filledRoles: filled,
                selectElementsCount: selectElements.length,
                inputElementsCount: inputDataWithElement.length,
            });

            // Validate unfilled fields before passing to AI
            console.log('[Autofill] Calling validateUnfilledFields...');
            const validation = validateUnfilledFields(
                filled,
                inputDataWithElement,
                selectElements,
                personalInfo,
                firstName,
                lastName
            );
            console.log('[AutofillFlow] validateUnfilledFields result', validation);

            console.log('[Autofill] ===== VALIDATION RESULT =====');
            console.log('[Autofill] Validation result:', {
                isValid: validation.isValid,
                reason: validation.reason,
                missingFields: validation.missingFields,
            });

            if (!validation.isValid) {
                console.log('[Autofill] ❌ STOPPING HERE - Validation failed, NOT calling AI');
                console.log('[Autofill] Skipping AI autofill - validation failed:', {
                    reason: validation.reason,
                    missingFields: validation.missingFields,
                    notFilled: discoveredTotal - filledCount,
                    discovered: discoveredTotal,
                    filled: filledCount,
                    filledRoles: filled,
                });
                sendLogtoBack({
                    message: 'Skipping AI autofill - missing data in personalInfo',
                    level: 'warning',
                    object: {
                        reason: validation.reason,
                        missingFields: validation.missingFields,
                    },
                });
            } else {
                console.log('[Autofill] ✅ VALIDATION PASSED - Calling AI function...');
                console.log('[Autofill] Calling autoFillRegistrationFormWithAI2 with personalInfo:', {
                    hasDOB: !!personalInfo.dob,
                    hasEmail: !!personalInfo.email,
                    hasPhone: !!personalInfo.phone,
                    hasName: !!personalInfo.name,
                });
                console.log('[AutofillFlow] Calling autoFillRegistrationFormWithAI2');
                const aiPromise = autoFillRegistrationFormWithAI2(personalInfo);
                console.log('[Autofill] ✅ AI function called successfully');
                console.log('[Autofill] Not filled fields count:', {
                    notFilled: discoveredTotal - filledCount,
                    discovered: discoveredTotal,
                    filled: filledCount,
                    breakdown: {
                        inputs: discoveredInputs,
                        selects: discoveredSelects,
                    },
                });
                return { filled, success: filled.length > 0, aiPromise };
            }
        } else {
            console.log('[Autofill] ❌ STOPPING HERE - Condition NOT met: discoveredTotal <= filledCount');
            console.log('[Autofill] All fields filled or no fields discovered, skipping AI call');
            console.log('[Autofill] Details:', {
                discoveredTotal,
                filledCount,
                condition: `${discoveredTotal} > ${filledCount}`,
                result: discoveredTotal > filledCount,
            });
        }

        return { filled, success: filled.length > 0 };
    } catch (error) {
        sendLogtoBack({
            message: 'Error in autofillRegistrationForm',
            level: 'error',
            object: { error },
        });
        return { filled: [], success: false };
    }
};

/**
 * Autofills registration form using AI for field classification
 * Falls back to regular classification if AI is not available or fails
 */
export const autoFillRegistrationFormWithAI = async (
    personalInfo: personalInfoFields_v1
): Promise<{ filled: string[]; success: boolean }> => {
    try {
        const filled: string[] = [];

        if (!inputDataWithElement || inputDataWithElement.length === 0) {
            sendLogtoBack({
                message: 'No input fields found for registration autofill with AI',
                level: 'error',
            });
            return { filled: [], success: false };
        }

        // Prepare data for AI
        const inputDataForAI = inputDataWithElement.map((item) => ({
            outerHTMLInput: item.outerHTMLInput,
            outerHTMLLabel: item.outerHTMLLabel,
            outerHTMLAria: item.outerHTMLAria,
        }));

        let aiClassification: Record<string, number> | null = null;
        let useAI = false;

        // Try to use AI for classification
        try {
            // Uncomment when AI is enabled
            const aiResponse = await callRegistrationFormAI({
                data: JSON.stringify(inputDataForAI),
                loggingEnabled: true,
            });
            const aiResult = JSON.parse(aiResponse);

            if (aiResult?.success && aiResult?.data) {
                aiClassification = aiResult.data;
                useAI = true;
                sendLogtoBack({
                    message: 'AI classification successful for registration form',
                    level: 'info',
                    object: { classifications: aiClassification },
                });
            } else {
                sendLogtoBack({
                    message: 'AI classification failed, using regular classification',
                    level: 'warning',
                    object: { error: aiResult?.error },
                });
            }
        } catch (aiError) {
            // sendLogtoBack({
            //     message: 'AI classification error, falling back to regular classification',
            //     level: 'warning',
            //     object: { error: aiError },
            // });
        }

        // Parse full name once for reuse
        const { firstName, lastName } = parseFullName(personalInfo.name || '');

        // Collect and process select/dropdown elements (same as regular autofill)
        const selectElements = collectSelectElements();
        selectElements.forEach((select) => {
            const role = classifySelectElement(select);
            if (role === 'unknown') return;

            let value: string | null = null;

            // Map role to personal info value (same logic as regular autofill)
            if (role === 'country') {
                value =
                    personalInfo.additionalFields?.country ||
                    personalInfo.additionalFields?.countryName ||
                    personalInfo.additionalFields?.nationality ||
                    null;
            } else if (role === 'state') {
                value =
                    personalInfo.additionalFields?.state ||
                    personalInfo.additionalFields?.stateName ||
                    personalInfo.additionalFields?.province ||
                    personalInfo.additionalFields?.region ||
                    null;
            } else if (role === 'city') {
                value =
                    personalInfo.additionalFields?.city ||
                    personalInfo.additionalFields?.cityName ||
                    personalInfo.additionalFields?.town ||
                    null;
            } else if (role === 'gender') {
                value =
                    personalInfo.additionalFields?.gender ||
                    personalInfo.additionalFields?.sex ||
                    personalInfo.additionalFields?.title ||
                    null;
            } else if (role === 'timezone') {
                value = personalInfo.additionalFields?.timezone || null;
            } else if (role === 'language') {
                value = personalInfo.additionalFields?.language || personalInfo.additionalFields?.lang || null;
            } else if (role === 'currency') {
                value = personalInfo.additionalFields?.currency || null;
            } else {
                value = personalInfo.additionalFields?.[role] || null;
            }

            if (value) {
                const success = selectOption(select, value);
                if (success) {
                    (select as HTMLElement).style.outline = '3px solid orange';
                    filled.push(role);
                }
            }
        });

        // Process input and textarea elements
        inputDataWithElement.forEach((item, index) => {
            let role: string;

            // Use AI classification if available, otherwise use regular classification
            if (useAI && aiClassification) {
                // Find the role for this index from AI classification
                role = Object.keys(aiClassification).find(
                    (key) => aiClassification![key] === index
                ) || 'unknown';
            } else {
                // Use regular classification
                role = classifyInputV2ForRegistration(item);

                // If role is still unknown, try the name field type detector as fallback
                if (role === 'unknown') {
                    const nameFieldType = detectNameFieldType(item);
                    if (nameFieldType) {
                        role = nameFieldType;
                    }
                }
            }

            let value: string | null = null;

            // Map role to personal info value (same logic as regular autofill)
            if (role === 'firstname') {
                value = firstName || personalInfo.additionalFields?.firstname || personalInfo.additionalFields?.firstName || null;
            } else if (role === 'lastname') {
                value = lastName || personalInfo.additionalFields?.lastname || personalInfo.additionalFields?.lastName || null;
            } else if (role === 'fullname') {
                value = personalInfo.name || null;
            } else if (role === 'middlename') {
                value = personalInfo.additionalFields?.middlename || personalInfo.additionalFields?.middleName || null;
            } else if (role === 'company') {
                value = personalInfo.additionalFields?.company || personalInfo.additionalFields?.companyName || personalInfo.additionalFields?.organization || null;
            } else if (role === 'name') {
                value = personalInfo.name || firstName || null;
            } else if (role === 'email') {
                value = personalInfo.email || null;
            } else if (role === 'phone') {
                value = personalInfo.phone || null;
            } else if (role === 'address') {
                value = personalInfo.additionalFields?.address || null;
            } else if (role === 'country') {
                value =
                    personalInfo.additionalFields?.country ||
                    personalInfo.additionalFields?.countryName ||
                    personalInfo.additionalFields?.nationality ||
                    null;
            } else if (role === 'state') {
                value =
                    personalInfo.additionalFields?.state ||
                    personalInfo.additionalFields?.stateName ||
                    personalInfo.additionalFields?.province ||
                    personalInfo.additionalFields?.region ||
                    null;
            } else if (role === 'city') {
                value =
                    personalInfo.additionalFields?.city ||
                    personalInfo.additionalFields?.cityName ||
                    personalInfo.additionalFields?.town ||
                    null;
            } else if (role === 'username') {
                value = personalInfo.additionalFields?.username || null;
            } else if (role !== 'unknown') {
                // Check additionalFields for custom fields (case-insensitive)
                const roleLower = role.toLowerCase();
                value =
                    personalInfo.additionalFields?.[role] ||
                    personalInfo.additionalFields?.[roleLower] ||
                    personalInfo.additionalFields?.[roleLower.charAt(0).toUpperCase() + roleLower.slice(1)] ||
                    null;
            }

            if (value && role !== 'unknown') {
                try {
                    (item.input as HTMLInputElement).value = value;
                    item.input.dispatchEvent(new Event('input', { bubbles: true }));
                    item.input.dispatchEvent(new Event('change', { bubbles: true }));
                    (item.input as HTMLElement).style.outline = '2px solid #3b82f6';
                    (item.input as HTMLElement).style.borderColor = '#3b82f6';
                    filled.push(role);

                    sendLogtoBack({
                        message: `Filled ${role} field with value (${useAI ? 'AI' : 'regular'} classification)`,
                        level: 'info',
                        object: { role, hasValue: !!value, method: useAI ? 'AI' : 'regular' },
                    });
                } catch (error) {
                    sendLogtoBack({
                        message: 'Error filling field in registration form',
                        level: 'error',
                        object: { error, role },
                    });
                }
            }
        });

        sendLogtoBack({
            message: `Registration form autofilled with ${useAI ? 'AI' : 'regular'} method: ${filled.length} fields`,
            level: filled.length > 0 ? 'success' : 'warning',
            object: { filled, method: useAI ? 'AI' : 'regular' },
        });

        return { filled, success: filled.length > 0 };
    } catch (error) {
        sendLogtoBack({
            message: 'Error in autoFillRegistrationFormWithAI',
            level: 'error',
            object: { error },
        });
        return { filled: [], success: false };
    }
};

function extractKeys(obj: any) {
    const keys: string[] = [];

    function recurse(current: any, _prefix = "") {
        for (const [k, v] of Object.entries(current)) {
            const normalizedKey = k.toLowerCase().trim();
            if (v && typeof v === "object" && !Array.isArray(v)) {
                recurse(v, normalizedKey);
            } else {
                keys.push(normalizedKey);
            }
        }
    }

    recurse(obj);
    return keys;
}

/**
 * Enriches input field data by checking parent/child elements for context
 * First checks if input has placeholder or role indicators
 * If not, searches parent component's child tags for text values
 */
function enrichInputFieldWithContext(field: {
    outerHTMLInput: string | null;
    outerHTMLLabel: string | null;
    outerHTMLAria: string | null;
    input: HTMLElement;
}): {
    outerHTMLInput: string | null;
    outerHTMLLabel: string | null;
    outerHTMLAria: string | null;
    outerHTMLPlaceholder: string | null;
    input: HTMLElement;
} {
    const input = field.input;
    let enrichedPlaceholder: string | null = null;

    // First, check if input has placeholder or other role indicators
    const placeholder = input.getAttribute('placeholder');
    const name = input.getAttribute('name');
    const id = input.getAttribute('id');
    const type = input.getAttribute('type');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');

    // Check if placeholder contains "search" - ignore this input

    if (placeholder && placeholder.toLowerCase().includes('search')) {
        return {
            ...field,
            outerHTMLPlaceholder: null,
        };
    }

    // If we already have good indicators, use them
    if (placeholder || name || id || ariaLabel || ariaLabelledBy || type !== "text") {
        enrichedPlaceholder = placeholder || name || id || ariaLabel || null;
    } else {
        // If not, check parent component and search child tags
        const parent = input.parentElement;
        if (parent) {
            // Search for child elements that might contain labels or hints
            const childLabels = parent.querySelectorAll('label, span, div, p, small, .label, .hint, .helper-text');
            const textValues: string[] = [];

            childLabels.forEach((child) => {
                // Skip the input itself
                if (child === input || child.contains(input)) return;

                const text = child.textContent?.trim();
                console.log("text", text);
                if (text && text.length > 0 && text.length < 100) {
                    // Ignore text values that contain "search"
                    if ((!text.toLowerCase().includes('search') || !text.toLowerCase().includes('varify code'))) {
                        textValues.push(text);
                    }
                }
            });

            // Also check for data attributes or classes that might indicate role
            const dataLabel = parent.getAttribute('data-label') ||
                parent.getAttribute('data-field-name') ||
                parent.getAttribute('data-placeholder');

            if (dataLabel && !dataLabel.toLowerCase().includes('search')) {
                textValues.unshift(dataLabel);
            }

            // Check parent's class names for hints
            const parentClasses = parent.className;
            if (parentClasses) {
                const classMatch = parentClasses.match(/(?:field|input|form)[_-]?(\w+)/i);
                if (classMatch && classMatch[1] && !classMatch[1].toLowerCase().includes('search')) {
                    textValues.push(classMatch[1]);
                }
            }

            // Combine found values
            if (textValues.length > 0) {
                enrichedPlaceholder = textValues.join(' | ');
            }

            // If still nothing, check parent's parent (grandparent)
            if (!enrichedPlaceholder) {
                const grandparent = parent.parentElement;
                if (grandparent) {
                    const grandparentLabels = grandparent.querySelectorAll('label, .label, .field-label');
                    const grandparentTexts: string[] = [];

                    grandparentLabels.forEach((label) => {
                        if (label.contains(input)) return;
                        const text = label.textContent?.trim();
                        if (text && text.length > 0 && text.length < 100) {
                            // Ignore text values that contain "search"
                            if (!text.toLowerCase().includes('search')) {
                                grandparentTexts.push(text);
                            }
                        }
                    });

                    if (grandparentTexts.length > 0) {
                        enrichedPlaceholder = grandparentTexts.join(' | ');
                    }
                }
            }
        }
    }

    // Final check: if enrichedPlaceholder contains "search", ignore it
    if (enrichedPlaceholder && enrichedPlaceholder.toLowerCase().includes('search')) {
        enrichedPlaceholder = null;
    }

    return {
        ...field,
        outerHTMLPlaceholder: enrichedPlaceholder,
    };
}

/**
 * Collects all dropdown elements including select, combobox, and listbox
 */
const collectAllDropdownElements = (): Array<{
    outerHTMLInput: string | null;
    outerHTMLLabel: string | null;
    outerHTMLAria: string | null;
    input: HTMLElement;
}> => {
    const results: Array<{
        outerHTMLInput: string | null;
        outerHTMLLabel: string | null;
        outerHTMLAria: string | null;
        input: HTMLElement;
    }> = [];

    try {
        // Import helper functions from autofillContent
        const getLabelTextNew = (input: HTMLElement): string => {
            if (input.id) {
                const lab = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
                if (lab) return (lab as HTMLElement).innerText.trim();
            }
            const wrapper = input.closest('label');
            if (wrapper) {
                const clone = wrapper.cloneNode(true) as HTMLElement;
                clone.querySelectorAll('input,textarea,select').forEach((n) => n.remove());
                if (clone.innerText.trim()) return clone.innerText.trim();
            }
            const ariaLabel = input.getAttribute('aria-label');
            if (ariaLabel) return ariaLabel.trim();
            const labelledBy = input.getAttribute('aria-labelledby');
            if (labelledBy) {
                return labelledBy
                    .split(/\s+/)
                    .map((id) => document.getElementById(id))
                    .filter(Boolean)
                    .map((el) => (el ? el.innerText.trim() : ''))
                    .filter(Boolean)
                    .join(' ');
            }
            return '';
        };

        const getAriaLabelTextNew = (input: HTMLElement): string => {
            const ariaLabel = input.getAttribute('aria-label');
            if (ariaLabel) return ariaLabel.trim();
            const labelledBy = input.getAttribute('aria-labelledby');
            if (labelledBy) {
                return labelledBy
                    .split(/\s+/)
                    .map((id) => document.getElementById(id))
                    .filter(Boolean)
                    .map((el) => (el ? el.innerText.trim() : ''))
                    .filter(Boolean)
                    .join(' ');
            }
            return '';
        };

        // Collect <select> elements
        const selects = document.querySelectorAll('select');
        selects.forEach((select) => {
            const parentDiv = select.closest('div[id*="byteseal" i]');
            if (!parentDiv && isVisibleDeep(select)) {
                const labelNew = getLabelTextNew(select);
                const ariaLabelNew = getAriaLabelTextNew(select);
                results.push({
                    outerHTMLInput: select.outerHTML || null,
                    outerHTMLLabel: labelNew || null,
                    outerHTMLAria: ariaLabelNew || null,
                    input: select,
                });
            }
        });

        // Collect custom combobox elements (div with role="combobox")
        const comboboxes = document.querySelectorAll('[role="combobox"]');
        comboboxes.forEach((combobox) => {
            if (combobox instanceof HTMLElement) {
                const parentDiv = combobox.closest('div[id*="byteseal" i]');
                if (!parentDiv && isVisibleDeep(combobox)) {
                    const labelNew = getLabelTextNew(combobox);
                    const ariaLabelNew = getAriaLabelTextNew(combobox);
                    results.push({
                        outerHTMLInput: combobox.outerHTML || null,
                        outerHTMLLabel: labelNew || null,
                        outerHTMLAria: ariaLabelNew || null,
                        input: combobox,
                    });
                }
            }
        });

        // Collect listbox elements (div with role="listbox")
        const listboxes = document.querySelectorAll('[role="listbox"]');
        listboxes.forEach((listbox) => {
            if (listbox instanceof HTMLElement) {
                const parentDiv = listbox.closest('div[id*="byteseal" i]');
                if (!parentDiv && isVisibleDeep(listbox)) {
                    const labelNew = getLabelTextNew(listbox);
                    const ariaLabelNew = getAriaLabelTextNew(listbox);
                    results.push({
                        outerHTMLInput: listbox.outerHTML || null,
                        outerHTMLLabel: labelNew || null,
                        outerHTMLAria: ariaLabelNew || null,
                        input: listbox,
                    });
                }
            }
        });

        // Also check for common dropdown patterns (MUI Select, etc.)
        // Look for divs with class names containing "select" or "dropdown" that have aria-controls
        const customDropdowns = document.querySelectorAll('div[aria-controls], div[aria-haspopup="listbox"]');
        customDropdowns.forEach((dropdown) => {
            if (dropdown instanceof HTMLElement) {
                // Skip if already collected as combobox
                if (dropdown.getAttribute('role') === 'combobox' || dropdown.getAttribute('role') === 'listbox') {
                    return;
                }
                const parentDiv = dropdown.closest('div[id*="byteseal" i]');
                if (!parentDiv && isVisibleDeep(dropdown)) {
                    const labelNew = getLabelTextNew(dropdown);
                    const ariaLabelNew = getAriaLabelTextNew(dropdown);
                    results.push({
                        outerHTMLInput: dropdown.outerHTML || null,
                        outerHTMLLabel: labelNew || null,
                        outerHTMLAria: ariaLabelNew || null,
                        input: dropdown,
                    });
                }
            }
        });

    } catch (error) {
        sendLogtoBack({
            message: 'Error collecting dropdown elements',
            level: 'error',
            object: { error },
        });
    }

    return results;
};

/**
 * Detects the expected month format from a field and converts the month value accordingly
 * Handles: 0-11 (JS Date), 1-12 (numeric), "01"-"12" (zero-padded), "jan"-"dec" (short), "january"-"december" (full)
 */
function formatMonthForField(month: string, field: HTMLElement): string {
    if (!month) return month;

    // Convert month from "01"-"12" to numeric for easier conversion
    const monthNum = parseInt(month, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return month;

    // Month name maps
    const monthNamesShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthNamesFull = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    // If it's a select dropdown, check the options to determine format
    if (field instanceof HTMLSelectElement) {
        const options = Array.from(field.options);
        if (options.length === 0) return month.padStart(2, '0');

        // Collect all option values and texts for analysis
        const optionValues = options.map(opt => opt.value.toLowerCase().trim());
        const optionTexts = options.map(opt => opt.text.toLowerCase().trim());
        const allOptions = [...optionValues, ...optionTexts];

        // Check for month names (short or full) - highest priority
        const hasMonthNames = allOptions.some(opt =>
            monthNamesShort.some(name => opt === name || opt.includes(name)) ||
            monthNamesFull.some(name => opt === name || opt.includes(name))
        );

        if (hasMonthNames) {
            // Check if it prefers full names or short names
            // Try to match the exact format used in options
            for (const option of options) {
                const optValue = option.value.toLowerCase().trim();
                const optText = option.text.toLowerCase().trim();

                // Check for exact match with short name
                if (optValue === monthNamesShort[monthNum - 1] || optText === monthNamesShort[monthNum - 1]) {
                    return monthNamesShort[monthNum - 1];
                }
                // Check for exact match with full name
                if (optValue === monthNamesFull[monthNum - 1] || optText === monthNamesFull[monthNum - 1]) {
                    return monthNamesFull[monthNum - 1];
                }
            }
            // Default to short name if month names are detected
            return monthNamesShort[monthNum - 1];
        }

        // Check for numeric formats
        const numericValues = optionValues
            .map(val => parseInt(val, 10))
            .filter(val => !isNaN(val));

        if (numericValues.length > 0) {
            const minVal = Math.min(...numericValues);
            const maxVal = Math.max(...numericValues);

            // Check if it's 0-11 format (JS Date format)
            if (minVal === 0 && maxVal === 11) {
                return (monthNum - 1).toString();
            }

            // Check if it's 1-12 format
            if (minVal === 1 && maxVal === 12) {
                return monthNum.toString();
            }
        }

        // Check for zero-padded format "01"-"12"
        const hasZeroPadded = optionValues.some(val => /^0[1-9]|1[0-2]$/.test(val));
        if (hasZeroPadded) {
            return month.padStart(2, '0');
        }

        // Try to find a matching option with the month number
        const zeroPadded = month.padStart(2, '0');
        const numeric = monthNum.toString();
        const jsFormat = (monthNum - 1).toString();

        // Try each format and see if any option matches
        for (const option of options) {
            const optValue = option.value.trim();
            const optText = option.text.trim();

            if (optValue === zeroPadded || optText === zeroPadded ||
                optText.includes(zeroPadded)) {
                return zeroPadded;
            }
            if (optValue === numeric || optText === numeric ||
                optText.includes(` ${numeric} `) || optText.startsWith(`${numeric} `) || optText.endsWith(` ${numeric}`)) {
                return numeric;
            }
            if (optValue === jsFormat || optText === jsFormat) {
                return jsFormat;
            }
        }

        // Last resort: try month name matching
        for (const option of options) {
            const optText = option.text.toLowerCase();
            if (optText.includes(monthNamesShort[monthNum - 1]) ||
                optText.includes(monthNamesFull[monthNum - 1])) {
                // Return the format that matches
                if (optText.includes(monthNamesFull[monthNum - 1])) {
                    return monthNamesFull[monthNum - 1];
                }
                return monthNamesShort[monthNum - 1];
            }
        }
    }

    // For input fields, check attributes and patterns
    if (field instanceof HTMLInputElement) {
        const placeholder = (field.placeholder || '').toLowerCase();
        const pattern = (field.getAttribute('pattern') || '').toLowerCase();
        const name = (field.getAttribute('name') || '').toLowerCase();
        const id = (field.getAttribute('id') || '').toLowerCase();
        const allAttrs = `${placeholder} ${pattern} ${name} ${id}`;

        // Check if attributes suggest month names
        if (allAttrs.includes('jan') || allAttrs.includes('feb') ||
            pattern.includes('[a-z]') || pattern.includes('[A-Z]')) {
            // Check if full names are preferred
            if (allAttrs.includes('january') || allAttrs.includes('february')) {
                return monthNamesFull[monthNum - 1];
            }
            return monthNamesShort[monthNum - 1];
        }

        // Check if it expects 0-11 (uncommon but possible)
        if (allAttrs.includes('0-11') || allAttrs.includes('0 to 11')) {
            return (monthNum - 1).toString();
        }

        // Check if it expects 1-12 (no zero padding)
        if (allAttrs.includes('1-12') || allAttrs.includes('1 to 12')) {
            return monthNum.toString();
        }

        // Default: return zero-padded for inputs (most common)
        return month.padStart(2, '0');
    }

    // Default: return zero-padded format
    return month.padStart(2, '0');
}

// Helper function to parse date
function parseDate(dob: string): { year: string; month: string; day: string } | null {
    // Define a map for month abbreviations and full month names (case-insensitive keys)
    const monthMap: { [key: string]: string } = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04',
        june: '06', july: '07', august: '08', september: '09', october: '10',
        november: '11', december: '12'
    };

    // Normalize the date string: trim and normalize spaces, but keep structure
    dob = dob.trim().replace(/\s+/g, ' ');

    let day: string, month: string, year: string;

    // Try multiple regex patterns for different date formats

    // Pattern 1: Month name formats (e.g., "Oct 10, 2001", "oct 10,2001", "October 10 2001")
    const monthNamePattern = /([a-zA-Z]+)\s+(\d{1,2})\s*,?\s*(\d{4})/i;
    let match = dob.match(monthNamePattern);
    if (match) {
        const monthName = match[1].toLowerCase();
        day = match[2];
        year = match[3];

        // Try full name first, then abbreviation
        const foundMonth = monthMap[monthName] || monthMap[monthName.slice(0, 3)];
        if (foundMonth) {
            month = foundMonth.padStart(2, '0');
            day = day.padStart(2, '0');
            return { year, month, day };
        }
    }

    // Pattern 2: DD-MM-YYYY, DD/MM/YYYY, DD MM YYYY, DD.MM.YYYY
    const dmyPattern = /^(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{4})$/;
    match = dob.match(dmyPattern);
    if (match) {
        day = match[1];
        month = match[2];
        year = match[3];
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        return { year, month, day };
    }

    // Pattern 3: MM-DD-YYYY, MM/DD/YYYY, MM DD YYYY, MM.DD.YYYY
    const mdyPattern = /^(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{4})$/;
    match = dob.match(mdyPattern);
    if (match) {
        // Try to determine if it's MDY or DMY by checking if first part > 12
        const first = parseInt(match[1], 10);
        const second = parseInt(match[2], 10);

        if (first > 12 && second <= 12) {
            // Likely DMY format
            day = match[1];
            month = match[2];
        } else if (first <= 12 && second > 12) {
            // Likely MDY format
            month = match[1];
            day = match[2];
        } else {
            // Ambiguous - assume MDY (US format)
            month = match[1];
            day = match[2];
        }
        year = match[3];
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        return { year, month, day };
    }

    // Pattern 4: YYYY-MM-DD, YYYY/MM/DD, YYYY MM DD, YYYY.MM.DD
    const ymdPattern = /^(\d{4})[-/.\s]+(\d{1,2})[-/.\s]+(\d{1,2})$/;
    match = dob.match(ymdPattern);
    if (match) {
        year = match[1];
        month = match[2];
        day = match[3];
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        return { year, month, day };
    }

    // Pattern 5: DD-MM-YY, DD/MM/YY (2-digit year)
    const dmyShortPattern = /^(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{2})$/;
    match = dob.match(dmyShortPattern);
    if (match) {
        day = match[1];
        month = match[2];
        const shortYear = match[3];
        // Convert 2-digit year to 4-digit (assume 2000s for years 00-30, 1900s for 31-99)
        const yearNum = parseInt(shortYear, 10);
        year = (yearNum <= 30 ? '20' : '19') + shortYear;
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        return { year, month, day };
    }

    return null;
}


/**
 * Detects the expected date format from an input field
 * Checks type, placeholder, pattern, and other attributes
 */
function detectDateFormat(input: HTMLElement): string | null {
    if (input instanceof HTMLInputElement) {
        // Check input type
        if (input.type === 'date') {
            return 'YYYY-MM-DD'; // HTML5 date input always expects YYYY-MM-DD
        }

        // Check pattern attribute
        const pattern = input.getAttribute('pattern');
        if (pattern) {
            // Common patterns: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.
            if (pattern.includes('MM') && pattern.includes('DD') && pattern.includes('YYYY')) {
                return pattern.replace(/M+/g, 'MM').replace(/D+/g, 'DD').replace(/Y+/g, 'YYYY');
            }
        }

        // Check placeholder
        const placeholder = input.placeholder?.toLowerCase() || '';
        if (placeholder.includes('mm/dd/yyyy') || placeholder.includes('mm-dd-yyyy')) {
            return 'MM/DD/YYYY';
        }
        if (placeholder.includes('dd/mm/yyyy') || placeholder.includes('dd-mm-yyyy')) {
            return 'DD/MM/YYYY';
        }
        if (placeholder.includes('yyyy-mm-dd') || placeholder.includes('yyyy/mm/dd')) {
            return 'YYYY-MM-DD';
        }
        if (placeholder.includes('mm/dd/yy') || placeholder.includes('mm-dd-yy')) {
            return 'MM/DD/YY';
        }
        if (placeholder.includes('dd/mm/yy') || placeholder.includes('dd-mm-yy')) {
            return 'DD/MM/YY';
        }

        // Check data-format or similar attributes
        const dataFormat = input.getAttribute('data-format') || input.getAttribute('data-date-format');
        if (dataFormat) {
            return dataFormat.toUpperCase();
        }

        // Check class names for common date picker libraries
        const className = input.className || '';
        if (className.includes('datepicker') || className.includes('date-picker')) {
            // Default to MM/DD/YYYY for most date pickers
            return 'MM/DD/YYYY';
        }
    }

    return null; // Unknown format
}

/**
 * Formats a date string to match the target format
 */
function formatDateToMatch(dobValue: string, targetFormat: string | null): string {
    if (!targetFormat) {
        return dobValue; // Return as-is if format is unknown
    }

    // Parse the date value
    let parsedDate = parseDate(dobValue);
    if (!parsedDate) {
        // Try to parse as ISO date or other formats
        const date = new Date(dobValue);
        if (!isNaN(date.getTime())) {
            parsedDate = {
                year: date.getFullYear().toString(),
                month: (date.getMonth() + 1).toString().padStart(2, '0'),
                day: date.getDate().toString().padStart(2, '0'),
            };
        } else {
            return dobValue; // Return as-is if parsing fails
        }
    }

    const { year, month, day } = parsedDate;
    const shortYear = year.slice(-2);

    // Format according to target format
    switch (targetFormat) {
        case 'YYYY-MM-DD':
            return `${year}-${month}-${day}`;
        case 'MM/DD/YYYY':
            return `${month}/${day}/${year}`;
        case 'DD/MM/YYYY':
            return `${day}/${month}/${year}`;
        case 'MM-DD-YYYY':
            return `${month}-${day}-${year}`;
        case 'DD-MM-YYYY':
            return `${day}-${month}-${year}`;
        case 'MM/DD/YY':
            return `${month}/${day}/${shortYear}`;
        case 'DD/MM/YY':
            return `${day}/${month}/${shortYear}`;
        case 'MM-DD-YY':
            return `${month}-${day}-${shortYear}`;
        case 'DD-MM-YY':
            return `${day}-${month}-${shortYear}`;
        case 'YYYY/MM/DD':
            return `${year}/${month}/${day}`;
        default:
            // Try to apply the format pattern
            return targetFormat
                .replace(/YYYY/g, year)
                .replace(/YY/g, shortYear)
                .replace(/MM/g, month)
                .replace(/DD/g, day)
                .replace(/M/g, month.replace(/^0+/, ''))
                .replace(/D/g, day.replace(/^0+/, ''));
    }
}


const clearAllFieldValues = (fields: { input: HTMLElement }[]) => {
    fields.forEach(({ input }) => {
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
            setNativeValue(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        else if (input instanceof HTMLSelectElement) {
            clearSelectValueSafely(input);
        }

        // DO NOT touch custom dropdown DOM
        (input as HTMLElement).style.outline = '';
        (input as HTMLElement).style.borderColor = '';
    });
};


const setNativeValue = (element: any, value: string) => {
    const valueSetter = Object.getOwnPropertyDescriptor(
        element.constructor.prototype,
        'value'
    )?.set;

    valueSetter?.call(element, value);
};

const clearSelectValueSafely = (select: HTMLSelectElement) => {
    const options = Array.from(select.options);

    // 1️⃣ Find placeholder-like option
    const placeholderOption = options.find(opt =>
        opt.value === '' ||
        (opt.disabled && opt.selected) ||
        /select|choose|please/i.test(opt.text)
    );

    if (placeholderOption) {
        select.value = placeholderOption.value;
    } else {
        // 2️⃣ Index 0 has real value → clear completely
        select.selectedIndex = -1;
    }

    // Notify framework
    select.dispatchEvent(new Event('change', { bubbles: true }));
};


export const autoFillRegistrationFormWithAI2 = async (
    personalInfo: personalInfoFields_v1
): Promise<{ filled: string[]; success: boolean }> => {
    try {
        const userKeys = extractKeys(personalInfo);
        console.log("inputDataWithElement", inputDataWithElement)

        // Collect all dropdown elements (select, combobox, listbox)
        const dropdownElements = collectAllDropdownElements();
        console.log("dropdownElements", dropdownElements);

        // Combine input fields with dropdown elements
        const allFields = [
            ...inputDataWithElement.map(field => ({
                outerHTMLInput: field.outerHTMLInput,
                outerHTMLLabel: field.outerHTMLLabel,
                outerHTMLAria: field.outerHTMLAria,
                input: field.input as HTMLElement,
            })),
            ...dropdownElements,
        ];

        clearAllFieldValues(allFields);
        // Enrich fields with parent/child context before sending to AI
        const enrichedFields = allFields.map(field => enrichInputFieldWithContext(field));
        console.log("enrichedFields", enrichedFields);
        try {
            const aiResponse = await callRegistrationFormAI2({
                discoveredFields: enrichedFields,
                userKeys: userKeys,
                loggingEnabled: true,
            });
            const aiResult = JSON.parse(aiResponse);
            console.log("aiResult", aiResult);
            if (aiResult.success) {
                const mapping = aiResult.data;
                const filled: string[] = [];
                console.log("personalInfo", personalInfo)
                const { firstName, lastName } = parseFullName(personalInfo.name || '');
                console.log("firstName, lastName", firstName, +" ," + lastName)
                for (const [key, index] of Object.entries(mapping)) {
                    // Use allFields since AI mapping includes both inputs and dropdowns
                    const field = allFields[index as number];
                    if (!field) continue;
                    console.log("key, index", key, index)
                    let value: string | undefined;

                    // Map fields to firstName, lastName, etc.
                    if (key === 'firstname' || key === 'firstName') {
                        value = firstName || personalInfo.additionalFields?.firstname || personalInfo.additionalFields?.firstName;
                    } else if (key === 'lastname' || key === 'lastName') {
                        value = lastName || personalInfo.additionalFields?.lastname || personalInfo.additionalFields?.lastName;
                    } else if (key === "fullname") {
                        value = personalInfo.name || firstName || lastName;
                    } else {
                        console.log("workingupto here", key);
                        const directValue = personalInfo[key as keyof personalInfoFields_v1];
                        if (typeof directValue === "string") {
                            value = directValue;
                        } else {
                            value = personalInfo.additionalFields ? personalInfo.additionalFields[key] : undefined;
                        }
                        console.log("value in else", value);
                    }
                    // Date of Birth Handling (DOB)
                    if (key === 'dob' || key.includes('dob')) {
                        // Check multiple locations for DOB (case-insensitive)
                        const additionalFields = personalInfo?.additionalFields || {};
                        const dobValue: any =
                            personalInfo.dob ||
                            additionalFields.DOB ||
                            additionalFields.dob ||
                            additionalFields.Dob ||
                            additionalFields.dateOfBirth ||
                            additionalFields.dateofbirth ||
                            personalInfo[key as keyof personalInfoFields_v1];
                        if (dobValue) {
                            console.log("dobValue", dobValue);
                            const parsedDate = parseDate(dobValue);
                            console.log("parsedDate", parsedDate);
                            console.log("key value", key);
                            if (parsedDate && (key === "dob-year" || key.includes('dob-year') || key === "dob-month" || key.includes('dob-month') || key === "dob-day" || key.includes('dob-day'))) {
                                const { year, month, day } = parsedDate;
                                console.log("working", year, month, day);
                                console.log("key value", (key === "dob-year" || key.includes('dob-year')) && year);

                                let dobFieldHandled = false;

                                if ((key === "dob-year" || key.includes('dob-year')) && year) {
                                    console.log("yearField working", year);
                                    value = year;
                                    dobFieldHandled = true;
                                } else if ((key === "dob-month" || key.includes('dob-month')) && month) {
                                    // Format month according to what the field expects
                                    value = formatMonthForField(month, field.input);
                                    console.log("monthField working", month, "formatted to", value);
                                    dobFieldHandled = true;
                                } else if ((key === "dob-day" || key.includes('dob-day')) && day) {
                                    console.log("day inside condition", day)
                                    value = day;
                                    dobFieldHandled = true;
                                }

                                // If we handled a split DOB field, fill it and continue to avoid duplicate push
                                if (dobFieldHandled && value) {
                                    // Capture value for use in setTimeout
                                    const dobValue = value;
                                    // Fill the input/dropdown and mark as filled
                                    if (field.input instanceof HTMLInputElement || field.input instanceof HTMLTextAreaElement) {
                                        const inputElement = field.input;
                                        setTimeout(() => {
                                            inputElement.value = dobValue;
                                            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                                            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                                        }, 1000);
                                        (field.input as HTMLElement).style.outline = '2px solid #3b82f6';
                                        (field.input as HTMLElement).style.borderColor = '#3b82f6';
                                    } else if (field.input instanceof HTMLSelectElement) {
                                        const success = selectOption(field.input, dobValue);
                                        if (success) {
                                            (field.input as HTMLElement).style.outline = '2px solid #3b82f6';
                                            (field.input as HTMLElement).style.borderColor = '#3b82f6';
                                        }
                                    }
                                    // Push the specific DOB field type (dob-year, dob-month, or dob-day)
                                    filled.push(key);
                                    continue; // Skip the rest of the loop to avoid duplicate push at line 2326
                                }

                            } else {
                                console.log("dobValue", dobValue);
                                // Detect the date format expected by the input field
                                const expectedFormat = detectDateFormat(field.input);
                                console.log("Detected date format:", expectedFormat);
                                // Format the date to match the input's expected format
                                value = formatDateToMatch(dobValue, expectedFormat);
                                console.log("Formatted date value:", value);
                            }
                        }
                    }
                    console.log("value", value);
                    if (!value) continue;

                    // Handle regular input/textarea elements FIRST (before checking for custom dropdowns)
                    // This ensures regular inputs with ARIA attributes (like autocomplete) are filled properly
                    if (field.input instanceof HTMLInputElement || field.input instanceof HTMLTextAreaElement) {
                        const inputElement = field.input;
                        console.log("inputElement", inputElement);

                        setTimeout(() => {
                            console.log("value", value);
                            console.log("field.input", field.input);
                            inputElement.value = value;
                            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                        }, 1000);

                        if (!inputElement.value && key !== 'unknown') {
                            const inputId = inputElement.id; // Get the input's id
                            console.log(`Input ID: ${inputId}`);

                            // Get the parent element of the input, assuming it's a direct parent
                            const parentElement = inputElement.parentElement;

                            if (parentElement) {
                                // Find the index of the input element in its parent
                                const inputs = Array.from(parentElement.getElementsByTagName('input'));
                                const inputIndex = inputs.indexOf(inputElement as HTMLInputElement);

                                if (inputIndex >= 0) {
                                    console.log(`Found input at index: ${inputIndex}`);

                                    // Get the specific input element by index
                                    const inputElement = inputs[inputIndex];
                                    console.log("inputElement", inputElement);

                                    // Check if the element exists and is an HTMLInputElement
                                    if (inputElement) {
                                        // Function to simulate typing each character in the value
                                        function simulateTyping(value: string) {
                                            let index = 0;

                                            function typeNextChar() {
                                                if (index < value.length) {
                                                    // Simulate key press for each character
                                                    const char = value[index];

                                                    // Set the value character by character
                                                    inputElement.value = inputElement.value + char; // Append char to current value
                                                    inputElement.dispatchEvent(new Event('focus', { bubbles: true }));

                                                    // Dispatch the 'input' event for React to update its state
                                                    const inputEvent = new Event('input', { bubbles: true });
                                                    inputElement.dispatchEvent(inputEvent);

                                                    // Move to the next character after a small delay
                                                    index++;
                                                    setTimeout(typeNextChar, 1);
                                                }
                                            }

                                            typeNextChar(); // Start simulating typing
                                        }

                                        // Set the value via simulated typing
                                        simulateTyping(value);

                                        // Optionally, you can dispatch 'focus' and 'blur' events if needed
                                        setTimeout(() => {
                                            inputElement.dispatchEvent(new Event('focus', { bubbles: true }));
                                            inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
                                        }, value.length * 50); // Ensure this is after typing completes
                                    } else {
                                        console.error(`Element with id "${inputId}" not found.`);
                                    }
                                } else {
                                    console.error(`Input element not found at the specified index.`);
                                }
                            } else {
                                console.error('Parent element not found.');
                            }
                        }

                        // Mark as filled
                        (field.input as HTMLElement).style.outline = '2px solid #3b82f6';
                        (field.input as HTMLElement).style.borderColor = '#3b82f6';
                        filled.push(key);
                    } else if (field.input instanceof HTMLSelectElement) {
                        // Standard select element
                        const success = selectOption(field.input, value);
                        if (success) {
                            (field.input as HTMLElement).style.outline = '2px solid #3b82f6';
                            (field.input as HTMLElement).style.borderColor = '#3b82f6';
                            filled.push(key);
                        }
                    } else if (
                        // Only treat as custom dropdown if it's NOT a regular input/textarea
                        !(field.input instanceof HTMLInputElement || field.input instanceof HTMLTextAreaElement) &&
                        (field.input.getAttribute('role') === 'combobox' ||
                            field.input.getAttribute('role') === 'listbox' ||
                            field.input.hasAttribute('aria-controls') ||
                            field.input.hasAttribute('aria-haspopup'))
                    ) {
                        // Custom dropdown element - for now, just log it
                        // TODO: Implement custom dropdown filling logic
                        console.log("Custom dropdown element found:", field.input);
                        console.log("Would fill with value:", value);
                        // Mark as filled even though we can't fill it yet
                        (field.input as HTMLElement).style.outline = '2px solid #3b82f6';
                        (field.input as HTMLElement).style.borderColor = '#3b82f6';
                        filled.push(key);
                    }
                }
                return { filled, success: true };
            } else {
                sendLogtoBack({
                    message: 'AI response is not successful',
                    level: 'error',
                    object: { error: aiResult },
                });
                return { filled: [], success: false };
            }
        } catch (error) {
            sendLogtoBack({
                message: 'Error in autoFillRegistrationFormWithAI2',
                level: 'error',
                object: { error },
            });
            return { filled: [], success: false };
        }
    } catch (error) {
        sendLogtoBack({
            message: 'Error in autoFillRegistrationFormWithAI2',
            level: 'error',
            object: { error },
        });
        return { filled: [], success: false };
    }
};
