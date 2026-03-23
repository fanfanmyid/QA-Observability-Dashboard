pipeline {
    agent any

    environment {
        // --- SESUAIKAN VARIABEL INI ---
        APP_NAME = 'qa-dashboard'
        MONITORING_IP = "${env.MONITORING_IP}" // Pastikan kamu set variable ini di Jenkins System / Global Properties (IP LXC 105)
        DEPLOY_DIR = "/opt/${APP_NAME}"
        
        SSH_KEY_ID = 'gateway-ssh-key' // Kunci sakti kita
        ENV_FILE_ID = 'qa-dashboard-env' // ID untuk file .env dashboard di Jenkins Credentials
    }

    stages {
        stage('1. Prepare Artifact') {
            steps {
                echo "Packaging source code safely using /tmp..."
                sh '''
                    # 1. Taruh file .tar.gz di folder /tmp/ agar tidak mengubah isi folder saat ini (.)
                    tar --exclude='./node_modules' --exclude='./frontend/node_modules' --exclude='./.git' --exclude='./backend/venv' -czf /tmp/${APP_NAME}.tar.gz .
                    
                    # 2. Setelah selesai dibungkus, pindahkan kembali ke workspace Jenkins
                    mv /tmp/${APP_NAME}.tar.gz .
                '''
            }
        }

        stage('2. Inject Secrets & Deploy') {
            steps {
                withCredentials([file(credentialsId: env.ENV_FILE_ID, variable: 'ENV_FILE')]) {
                    sshagent(credentials: [env.SSH_KEY_ID]) {
                        sh """
                            echo "Transferring files to Monitoring Server (${MONITORING_IP})..."
                            
                            # Buat folder jika belum ada
                            ssh -o StrictHostKeyChecking=no root@${MONITORING_IP} "mkdir -p ${DEPLOY_DIR}"
                            
                            # Kirim source code dan file .env
                            scp -o StrictHostKeyChecking=no ${APP_NAME}.tar.gz root@${MONITORING_IP}:${DEPLOY_DIR}/
                            scp -o StrictHostKeyChecking=no "\$ENV_FILE" root@${MONITORING_IP}:${DEPLOY_DIR}/.env
                            
                            echo "Extracting and building containers on the server..."
                            ssh -o StrictHostKeyChecking=no root@${MONITORING_IP} "
                                cd ${DEPLOY_DIR}
                                tar -xzf ${APP_NAME}.tar.gz
                                
                                # Hentikan container lama, build ulang, dan jalankan di background
                                docker compose down
                                docker compose up -d --build
                                
                                # Bersihkan file tar
                                rm ${APP_NAME}.tar.gz
                            "
                        """
                    }
                }
            }
        }

        stage('3. Smoke Test') {
            steps {
                echo "Waiting 10s for React & FastAPI to spin up..."
                sleep 10
                
                script {
                    // Cek apakah Nginx/React UI mengembalikan HTTP 200 OK
                    // Asumsi Frontend React jalan di port 80 pada docker-compose
                    def response = sh(
                        script: "curl -s -o /dev/null -w '%{http_code}' http://${MONITORING_IP}/",
                        returnStdout: true
                    ).trim()
                    
                    if (response == '200') {
                        echo "✅ SMOKE TEST PASSED: QA Dashboard is Live at http://${MONITORING_IP}"
                    } else {
                        error "❌ SMOKE TEST FAILED: Frontend HTTP Status ${response}"
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Cleaning up Jenkins workspace..."
            sh "rm -f ${APP_NAME}.tar.gz"
        }
        success {
            echo "🎉 QA Dashboard successfully deployed to Monitoring Server!"
        }
        failure {
            echo "⚠️ Deployment failed. Check the Jenkins logs."
        }
    }
}