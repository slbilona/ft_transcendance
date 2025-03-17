//Ajoute post Merge
function resetAuthForms() {
	const loginForm = document.getElementById('loginForm');
	const signupForm = document.getElementById('signupForm');

	if (loginForm) loginForm.reset();
	if (signupForm) signupForm.reset();
}

function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function validateInput(input, type) {
	input = input.trim();

	switch(type) {
		case 'username':
			const usernameRegex = /^[a-zA-Z0-9_-]{1,20}$/;
			return usernameRegex.test(input) ? input : "1";

		case 'alias':
			const aliasRegex = /^[a-zA-Z0-9_-]{1,20}$/;
			return aliasRegex.test(input) ? input : "1";

		case 'password':
			const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[.@,#$%^&+=!_\-])[A-Za-z\d.@,#$%^&+=!_\-]{8,}$/;
			return passwordRegex.test(input) ? input : "1";

		case 'email':
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			return emailRegex.test(input) ? input : "1";

		default:
			return input;
	}
}

function updateCsrfToken() {
	return fetch('/api/get-csrf-token/', {
		method: 'GET',
		credentials: 'include'
	})
	.then(response => response.json())
	.then(data => {
		document.querySelector('[name=csrfmiddlewaretoken]').value = data.csrfToken;
	});
}

//requête avec le token CSRF à jour
function fetchWithCsrf(url, options = {}) {
	return updateCsrfToken()
		.then(() => {
			options.headers = options.headers || {};
			options.headers['X-CSRFToken'] = getCsrfToken();
			options.credentials = 'include';
			return fetch(url, options);
		});
}


function updateUserInfo(username, photoProfile) {
	//const profilePictureElement = document.getElementById("profilePicture");

	if (username) {
		const safeUsername = escapeHtml(username);
		window.dispatchEvent(new Event('userLoggedIn'));

		document.getElementById('userUsernamePhoto').style.display = 'block';
		document.getElementById('liveChatLink').style.display = 'block';
		document.getElementById('friendLink').style.display = 'block';
		document.getElementById('userLink').style.display = 'block';
		document.getElementById('historiqueLink').style.display = 'block';
		document.getElementById('logoutButton').style.display = 'block';
		document.querySelector('.auth-button').style.display = 'none';
		// document.getElementById('userUsername').innerHTML = safeUsername;

		if (photoProfile) {
			// Construire l'URL de l'image en utilisant le chemin relatif vers le dossier MEDIA
			// const imageUrl = photoProfile.trim() + '?timestamp=' + Date.now();
			const imageUrl = `${photoProfile}?timestamp=${Date.now()}`;


			// Créer un objet Image pour vérifier si l'image existe
			const img = new Image();
			img.onload = function() {
				// Si l'image se charge correctement, l'URL est valide
				// Mettre à jour l'image dans l'élément HTML
				document.getElementById('userUsernamePhoto').innerHTML = `
					<img width="62" height="62"
						src="${imageUrl}"
						class="rounded-circle"
						id="profilePicture">
					<h4 id="userUsername">${safeUsername}</h4>
				`;
			};
			img.onerror = function() {
				// Si l'image ne se charge pas, afficher un message d'erreur
				// Tu peux aussi mettre une image par défaut ici, si tu veux
				document.getElementById('userUsernamePhoto').innerHTML = `
					<img width="62" height="62"
						src="/static/images/base_pfp.png"
						class="rounded-circle"
						id="profilePicture">
					<h4 id="userUsername">${safeUsername}</h4>
				`;
			};
			img.src = imageUrl; // Lance la vérification de l'image
		} else {
			document.getElementById('userUsernamePhoto').innerHTML = `
				<img width="62" height="62" 
					 src="/static/images/base_pfp.png" 
					 class="rounded-circle" 
					 id="profilePicture">
				<h4 id="userUsername">${safeUsername}</h4>
			`;
		}		
		initWebSocket();
	} else {
		document.getElementById('userUsernamePhoto').style.display = 'none';
		document.getElementById('liveChatLink').style.display = 'none';
		document.getElementById('friendLink').style.display = 'none';
		document.getElementById('userLink').style.display = 'none';
		document.getElementById('historiqueLink').style.display = 'none';
		document.getElementById('logoutButton').style.display = 'none';
		document.querySelector('.auth-button').style.display = 'block';
		document.getElementById('userUsernamePhoto').innerHTML = ``;
	}
}

function checkLoginStatus() {
	return fetchWithCsrf('/api/user/', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		}
	})
	.then(response => response.json())
	.then(data => {
		if (data.username) {
			updateUserInfo(data.username, data.photoProfile, data.alias);
		}
		else {
			updateUserInfo(null);
		}
	})
	.catch(error => {
		console.error('Error:', error);
		updateUserInfo(null);
	});
}

async function login(username, password) {
	return new Promise((resolve, reject) => {
		const validUsername = validateInput(username, 'username');
		const validPassword = validateInput(password, 'password');

		if (!validUsername || validUsername === "1") {
			alert(t('invalidUsernameFormat'));
			reject(new Error('Invalid username format'));
			return; // Arrête l'exécution si username invalide
		}

		if (!validPassword || validPassword === "1") {
			alert(t('invalidPasswordFormat'));
			reject(new Error('Invalid password format'));
			return; // Arrête l'exécution si password invalide
		}

		fetchWithCsrf('/api/login/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				username: validUsername,
				password: validPassword
			})
		})
		.then(response => response.json())  // Toujours parser la réponse JSON
		.then(data => {
			if (!data.success) {
				reject(new Error(data.message || 'Authentification échouée'));
				return;
			}
			const safeUser = {
				username: escapeHtml(data.user.username),
				photoProfile: data.user.photoProfile
			};
			updateUserInfo(safeUser.username, safeUser.photoProfile);
			checkLoginStatus();
			resetAuthForms();
			resolve(safeUser);
		})
		.catch(error => {
			console.error('Error details:', error);
			reject(new Error('Une erreur réseau est survenue'));
		});		
	})
}

async function signup(formData) {
	return new Promise((resolve, reject) => {
		const username = formData.get('username');
		const email = formData.get('email');
		const alias = formData.get('alias');
		const password = formData.get('password');

		// Validation des entrées utilisateur
		const validAlias = validateInput(alias, 'alias');
		const validUsername = validateInput(username, 'username');
		const validEmail = validateInput(email, 'email');
		const validPassword = validateInput(password, 'password');

		if (!validUsername || validUsername === "1") {
			alert(t('invalidUsernameFormat'));
			return reject(new Error('Invalid username format'));
		}
		if (!validEmail || validEmail === "1") {
			alert(t('invalidEmailFormat'));
			return reject(new Error('Invalid email format'));
		}
		if (!validAlias || validAlias === "1") {
			alert(t('invalidAliasFormat'));
			return reject(new Error('Invalid alias format'));
		}
		if (!validPassword || validPassword === "1") {
			alert(t('invalidPasswordFormat'));
			return reject(new Error('Invalid password format'));
		}

		// Préparation des données sécurisées pour l'inscription
		const secureFormData = new FormData();
		secureFormData.append('username', validUsername);
		secureFormData.append('email', validEmail);
		secureFormData.append('alias', validAlias);
		secureFormData.append('password', validPassword);

		// Ajout des autres champs du formulaire qui ne sont pas sensibles
		for (let [key, value] of formData.entries()) {
			if (!['username', 'email', 'alias', 'password'].includes(key)) {
				secureFormData.append(key, value);
			}
		}

		// Appel réseau pour l'inscription
		fetchWithCsrf('/api/signup/', {
			method: 'POST',
			body: secureFormData
		})
		.then(response => response.json())
		.then(data => {
			if (data.message === "Inscription réussie") {
				const safeUser = {
					username: escapeHtml(data.user.username),
					photoProfile: data.user.photoProfile,
					alias: data.user.alias ? escapeHtml(data.user.alias) : null
				};
				updateUserInfo(safeUser.username, safeUser.photoProfile);
				checkLoginStatus();
				resetAuthForms();//Ajoute post Merge
				resolve(safeUser);
			} else {
				reject(new Error(JSON.stringify(data.errors)));
			}
		})
		.catch(error => {
			//console.error('Error during signup:', error);
			reject(new Error(error));
		});
	});
}

async function logout() {
	// Ferme la connexion WebSocket si elle est ouverte
	if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
	    console.log("Fermeture de la WebSocket à la déconnexion.");
	    chatSocket.close();
	}

	return fetchWithCsrf('/api/logout/', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		}
	})
	.then(response => response.json())
	.then(data => {
		if (data.message === "Déconnexion réussie") {
			updateUserInfo(null);
			window.dispatchEvent(new Event('userLoggedOut'));
			resetAuthForms();
		} else {
			throw new Error(data.message);
		}
	})
	.catch(error => {
		throw new Error(error.message);
	});
}

const authModal = document.getElementById('authModal');

document.addEventListener('DOMContentLoaded', function() {
	checkLoginStatus();
	const loginForm = document.getElementById('loginForm');
	const signupForm = document.getElementById('signupForm');
	const logoutButton = document.getElementById('logoutButton');

	loginForm.addEventListener('submit', function(e) {
		e.preventDefault();
		const username = document.getElementById('loginUsername').value;
		const password = document.getElementById('loginPassword').value;

		login(username, password)
			.then(() => {
				const authModal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
				authModal.hide();
			})
			.catch(error => {
				console.log('Error:', error);
				alert(error);
				if (error.message && error.message === "Authentification failed") {
					alert('Erreur de connexion: ' + 'L\'identifiant ou mot de passe est incorrect. Veuillez réessayer');
				}
			});
	});

	signupForm.addEventListener('submit', function(e) {
		e.preventDefault();
		const formData = new FormData(this);

		signup(formData) 
			.then(() => {
				alert('Votre inscription a été réussie !');
				const authModal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
				authModal.hide();
			})
			.catch(error => {
				console.log('Error:', error.message);
				let errorMessage = '';
				// On vérifie si l'erreur est un objet Error et contient un message
				if (error.message && error.message !== "Invalid username format" && error.message !== "Invalid email format"
					&& error.message !== "Invalid alias format" && error.message !== "Invalid password format") {
					try {

						const errorData = JSON.parse(error.message);
						// Si l'objet contient des erreurs (data.errors), on les parcourt
						if (errorData) {
							for (let field in errorData) {
								if (errorData.hasOwnProperty(field)) {
									// Ajout de chaque message d'erreur sans le nom du champ
									errorMessage += `${errorData[field].join(', ')}\n`;
								}
							}
						}
						else {
							// Si pas d'erreurs spécifiques, affiche le message directement
							errorMessage += 'Détails de l\'erreur inconnus.';
						}
					} catch (e) {
						// Si le parsing échoue (le format n'est pas du JSON), on ajoute un message générique
						console.log(e);
					}
					// /!\ voir si ca focntionne toujours sans ca
					setErrorMessages();
					if (errorMessages[errorMessage.trim()]) {
						alert(errorMessages[errorMessage.trim()]);
					} else {
						alert(errorMessage);
					}
				}
			// Affichage du message d'erreur
		});
	});

	logoutButton.addEventListener('click', function() {
		logout()
			.then(() => {
			})
			.catch(error => {
				console.error('Error:', error);
				alert('Erreur de déconnexion: ' + error.message);
			});
	});

	document.getElementById('auth42Button').addEventListener('click', function (event) {
		event.preventDefault();  // 🔹 Empêche le rafraîchissement de la page
	
		fetch('https://localhost:8443/get-42-url/', {  // 🔹 Remplace `/get-42-url/` par l'URL complète
			method: 'GET',
			headers: {
				'X-Requested-With': 'XMLHttpRequest'
			}
		})
		.then(response => response.json())
		.then(data => {
			if (data.url) {
				window.location.href = data.url;  // 🔹 Redirige l’utilisateur vers 42
			} else {
				console.error("❌ Erreur : pas d'URL reçue");
			}
		})
		.catch(error => console.error('❌ Erreur AJAX:', error));
		
	});
});

const bouttonSignupLogin = document.getElementById('boutton-signup-login');

// Gestionnaire pour le clic sur le lien utilisateur
bouttonSignupLogin.addEventListener('click', (e) => {
	e.preventDefault();
	pushModalState5();
	openSignupLoginModal();
});

function pushModalState5() {
	// Sauvegarde le chemin actuel avant de le modifier
	previousPath = window.location.pathname;
	// Ajoute le nouvel état dans l'historique
	history.pushState(
		{
			modal: 'connexion',
			previousPath: previousPath
		},
		'',
		'/connexion'
	);
}

function openSignupLoginModal() {
	const modal = new bootstrap.Modal(authModal);
	modal.show();
}

function closeModal5() {
	const modal = bootstrap.Modal.getInstance(authModal);
	if (modal) {
		modal.hide();
	}
}

// Gestionnaire pour la navigation dans l'historique
window.addEventListener('popstate', (event) => {
	if (event.state && event.state.modal === 'connexion') {
		openSignupLoginModal();
	} else {
		closeModal5();
	}
});

// Gestionnaire pour la fermeture du modal
authModal.addEventListener('hidden.bs.modal', () => {
	if (window.location.pathname === '/connexion') {
		// Au lieu de history.back(), on push un nouvel état
		const targetPath = previousPath || '/';
		history.pushState(
			{
				modal: null,
				previousPath: '/connexion'
			},
			'',
			targetPath
		);
	}
});

// Gestion de l'état initial
if (window.location.pathname === '/connexion') {
	history.replaceState(
		{
			modal: 'connexion',
			previousPath: '/'
		},
		'',
		'/connexion'
	);
	openSignupLoginModal();
}