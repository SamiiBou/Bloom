// tiktok-app/src/components/WorldIDLogin.jsx
import React, { useState } from 'react';
import { IDKitWidget } from '@worldcoin/idkit';
import apiService from '../services/api';

const WorldIDLogin = ({ onLoginSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // App ID and Action configured by user
    const appId = 'app_f957956822118ea9a349f25a28f41176'; 
    const action = 'signing'; 

    const handleProof = async (proofResponse) => {
        setLoading(true);
        setError(null);
        console.log("Proof received from IDKit:", proofResponse);
        try {
            // proofResponse contains merkle_root, nullifier_hash, proof, credential_type, etc.
            // We send this data to our backend for verification.
            const backendResponse = await apiService.verifyWorldID({
                ...proofResponse, // Already contains app_id, action, etc.
            });

            console.log("Backend verification response:", backendResponse);

            if (backendResponse && backendResponse.data && backendResponse.data.token) {
                apiService.setToken(backendResponse.data.token); // Updates token in ApiService
                if (onLoginSuccess) {
                    onLoginSuccess(backendResponse.data.user); // Notifies parent component of success
                }
            } else {
                throw new Error(backendResponse.message || 'Verification failed or token was not received.');
            }
        } catch (err) {
            console.error("Error during World ID verification:", err);
            setError(err.message || 'An error occurred during World ID verification.');
        } finally {
            setLoading(false);
        }
    };

    const onSuccessIDKit = () => {
        // Called when IDKit modal is closed by user.
        // Actual login success is handled in handleProof after backend verification.
        console.log("IDKit modal closed.");
    };

    return (
        <div>
            <IDKitWidget
                app_id={appId}
                action={action}
                onSuccess={onSuccessIDKit} 
                handleVerify={handleProof} 
                credential_types={['orb', 'phone']} 
                // You can add other props like `signal` for more security
                // or `action_description` to customize text in the widget.
            >
                {({ open }) => (
                    <button onClick={open} disabled={loading || appId === 'app_YOUR_APP_ID_HERE'}>
                        {loading ? 'Verification in progress...' : 'Sign in with World ID'}
                    </button>
                )}
            </IDKitWidget>
            {appId === 'app_YOUR_APP_ID_HERE' && <p style={{ color: 'orange', fontSize: '0.8em' }}>Don't forget to configure your `app_id` in WorldIDLogin.jsx</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        </div>
    );
};

export default WorldIDLogin;
