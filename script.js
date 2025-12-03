/**
 * Medina Herb Society Website JavaScript
 * Handles smooth scrolling, scroll-based visibility animations, and Firebase Contact Form Submission.
 */

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL FIREBASE/APP VARIABLES ---
// These variables are provided by the hosting environment for secure access
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db;
let auth;
let userId = null;
let isAuthReady = false;

// Set Firestore log level for debugging
setLogLevel('error'); // Use 'debug' if troubleshooting is needed

// --- INITIALIZATION FUNCTION ---
const initializeFirebase = async () => {
    if (!firebaseConfig) {
        console.error("Firebase configuration is missing.");
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Set persistence to session (optional, but good practice)
        await setPersistence(auth, browserSessionPersistence);

        // Listen for authentication state changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in
                userId = user.uid;
            } else {
                // User is signed out, sign in anonymously for public data access
                try {
                    await signInAnonymously(auth);
                    userId = auth.currentUser.uid;
                } catch (error) {
                    console.error("Anonymous sign-in failed:", error);
                    // Generate a random ID if Firebase Auth completely fails
                    userId = crypto.randomUUID(); 
                }
            }
            isAuthReady = true;
            console.log("Firebase Auth Ready. User ID:", userId);
        });

        // Use custom token if provided (Canvas environment)
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        }

    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }
};

// --- FORM SUBMISSION HANDLER (Accessible globally via window) ---

/**
 * Handles the contact form submission, prevents default behavior, and saves data to Firestore.
 * Submissions are saved to a public collection for the site administrator to view.
 * @param {Event} event - The submission event.
 */
window.handleContactFormSubmission = async (event) => {
    event.preventDefault();

    const statusDiv = document.getElementById('form-status');
    const form = document.getElementById('contactForm');
    
    // --- FIX: Ensure status div is unhidden immediately ---
    statusDiv.classList.remove('success', 'error', 'hidden');
    statusDiv.textContent = 'Sending message...';
    // --------------------------------------------------------

    if (!isAuthReady || !db) {
        statusDiv.classList.add('error');
        statusDiv.textContent = 'Error: Service is still initializing. Please wait a few seconds and try again.';
        // No need for 'finally' if returning here, status is already updated and unhidden.
        return; 
    }

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !message) {
        statusDiv.classList.add('error');
        statusDiv.textContent = 'Please fill out all fields.';
        return;
    }
    
    // Disable button to prevent double submission
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        // Define the path for public inquiries collection
        const collectionPath = `/artifacts/${appId}/public/data/inquiries`;
        const inquiriesCollection = collection(db, collectionPath);
        
        await addDoc(inquiriesCollection, {
            name: name,
            email: email,
            message: message,
            timestamp: serverTimestamp(),
            // Store the user ID who submitted the message for security review
            submittedBy: userId 
        });

        statusDiv.classList.add('success');
        statusDiv.textContent = 'Message sent successfully! We will get back to you soon.';
        
        // Clear the form fields after success
        form.reset();

    } catch (error) {
        console.error("Error submitting message to Firestore:", error);
        statusDiv.classList.add('error');
        statusDiv.textContent = 'Error submitting message. Please check your connection and try again.';
    } finally {
        submitButton.disabled = false;
        // The message is already unhidden at the start of the function.
    }
};


// -------------------------------------------------------------------------
// 2. Scroll-Based Visibility (Fade-In Effect) & Smooth Scrolling
// -------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase on load
    initializeFirebase();

    // --- Smooth Scrolling Implementation ---
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault(); 
            const targetId = this.getAttribute('href'); 
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- Scroll-Based Visibility (Fade-In Effect) ---
    const sectionsToAnimate = document.querySelectorAll('main section, .contact-form-container, .contact-item, .mission-box');
    
    // Add initial hidden state via CSS class
    sectionsToAnimate.forEach(el => {
        el.classList.add('js-scroll-hidden'); 
    });

    const scrollObserverCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('js-scroll-visible');
                entry.target.classList.remove('js-scroll-hidden');
                observer.unobserve(entry.target);
            }
        });
    };

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver(scrollObserverCallback, observerOptions);
    sectionsToAnimate.forEach(el => observer.observe(el));
});