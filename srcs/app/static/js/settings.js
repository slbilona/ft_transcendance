function escapeHtml(unsafe) {
	if (typeof unsafe !== 'string') return '';
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function sanitizeAttribute(value) {
	if (typeof value !== 'string') return '';
	return value.replace(/javascript:/gi, '')
				.replace(/onerror=/gi, '')
				.replace(/<script.*?>.*?<\/script>/gi, '')
				.replace(/on\w+=/gi, '');
}

// const settingsModal = document.getElementById('settingsModal');

const settingsForm = document.getElementById('settingsForm');
const errorMessage = document.getElementById('errorMessage');

function validatePassword(password) {
	const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[.@,#$%^&+=!_\-])[A-Za-z\d.@,#$%^&+=!_\-]{8,}$/;
	return passwordRegex.test(password);
}

async function updateUserProfile(formData) {
	try {
		const username = formData.get('username');
		const email = formData.get('email');
		const alias = formData.get('alias');
		const password = formData.get('password');

		const validAlias = validateInput(alias, 'alias');
		const validUsername = validateInput(username, 'username');
		const validEmail = validateInput(email, 'email');
		const validPassword = validateInput(password, 'password');

		// Lancer des erreurs de validation
		if (validUsername == "1" && username) {
			throw new Error(t('invalidUsernameFormat'));
		} else if (validEmail == "1" && email) {
			throw new Error(t('invalidEmailFormat'));
		} else if (validAlias == "1" && alias) {
			throw new Error(t('invalidAliasFormat'));
		} else if (validPassword == "1" && password) {
			throw new Error(t('invalidPasswordFormat'));
		}

		// Sanitize les données du formulaire
		const sanitizedFormData = new FormData();
		for (let [key, value] of formData.entries()) {
			if (value instanceof File) {
				if (value.size > 0) {
					const sanitizedFileName = sanitizeAttribute(value.name);
					const sanitizedFile = new File([value], sanitizedFileName, {
						type: value.type,
						lastModified: value.lastModified
					});
					sanitizedFormData.append(key, sanitizedFile);
				}
			} else if (typeof value === 'string') {
				const sanitizedValue = sanitizeAttribute(value);
				if (sanitizedValue !== '') {
					sanitizedFormData.append(key, sanitizedValue);
				}
			}
		}
		const settingsNewPassword = document.getElementById('settingsNewPassword');
		const settingsConfirmPassword = document.getElementById('settingsConfirmPassword');
		// Validation du mot de passe
		const newPassword = sanitizedFormData.get('password');
		const confirmPassword = sanitizeAttribute(settingsConfirmPassword.value);

		if (newPassword) {
			if (!validatePassword(newPassword)) {
				throw new Error(t('invalidPasswordFormat'));
			}

			if (newPassword !== confirmPassword) {
				throw new Error(t('passwordsDoNotMatch'));
			}
		}
		// Si aucun champ n'est mis à jour
		if (sanitizedFormData.keys().next().done) {
			throw new Error(t('noUpdateFieldsProvided'));
		}
		// Envoi de la requête API
		const response = await fetchWithCsrf('/api/userprofileupdate/', {
			method: 'PUT',
			body: sanitizedFormData,
			credentials: 'include',
		});

		const responseBody = await response.clone().json();
		console.log("reponse", response);
		// Traitement de la réponse
		if (response.ok) {
			const alertDiv = document.createElement('div');
			alertDiv.className = 'alert alert-success';
			alertDiv.textContent = escapeHtml(t('profileUpdateSuccess'));
			const settingsForm = document.getElementById('settingsForm');
			settingsForm.insertBefore(alertDiv, settingsForm.firstChild);
			setTimeout(() => alertDiv.remove(), 3000);

			settingsNewPassword.value = '';
			settingsConfirmPassword.value = '';
			checkLoginStatus();
			const user = await checkLoginStatus2(); // Récupère l'objet utilisateur
			if (user && user.username) {
				updateUserInfo2(user);  // Passe `user` à la fonction
			} else {
				clearUserInfo();
			}
		} else {
			if (response.status === 400 && responseBody) {
				let errorMessages = [];
				if (responseBody.username) {
					errorMessages.push(t('UsernameError'));
				}
				if (responseBody.alias) {
					errorMessages.push(t('AliasError'));
				}
				if (responseBody.email) {
					errorMessages.push(t('EmailError'));
				}
				if (errorMessages.length > 0) {
					throw new Error(errorMessages.join(', '));
				}
			}
			throw new Error(t('profileUpdateError'));
		}
	} catch (error) {
		if (error && error.message) {
			const alertDiv = document.createElement('div');
			alertDiv.className = 'alert alert-danger';
			alertDiv.textContent = error.message; // Affichage de l'erreur
			console.log("error.message : ", error.message);
			console.error("erreur : ", error);
			const settingsForm = document.getElementById('settingsForm');
			settingsForm.insertBefore(alertDiv, settingsForm.firstChild);
			setTimeout(() => alertDiv.remove(), 3000);
		}
	}
}

// function opensettingsModal() {
//     const modal = new bootstrap.Modal(settingsModal);

//     fetchWithCsrf('/api/user/', {
//         method: 'GET',
//         headers: {
//             'Content-Type': 'application/json',
//         }
//     })
//     .then(response => {
//         if (response.ok) {
//             settingsForm.style.display = 'block';
//             errorMessage.style.display = 'none';
//         } else if (response.status === 401) {
//             settingsForm.style.display = 'none';
//             errorMessage.style.display = 'block';
//         } else {
//             throw new Error('Erreur inattendue lors de la vérification de l\'état de connexion.');
//         }
//     })
//     .catch(error => {
//         settingsForm.style.display = 'none';
//         errorMessage.style.display = 'block';
//     });

//     modal.show();
// }

// if (settingsForm) {
// 	settingsForm.addEventListener('submit', async (e) => {
// 		e.preventDefault();
// 		const formData = new FormData(settingsForm);
// 		await updateUserProfile(formData);
// 	});
// }

const photoInput = document.getElementById('settingsPhoto');
if (photoInput) {
	photoInput.addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function(e) {
				const photoPreview = document.getElementById('photoPreview');
				if (photoPreview) {
					photoPreview.src = e.target.result;
					photoPreview.style.display = 'block';
				}
			};
			reader.readAsDataURL(file);
		}
	});
}
