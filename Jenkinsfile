
pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
    }

    environment {
        AWS_REGION       = 'ap-south-1'
        AWS_ACCOUNT_ID   = '027195719990'
        ECR_REPOSITORY   = 'devops-task-manager'
        ECR_REGISTRY     = '027195719990.dkr.ecr.ap-south-1.amazonaws.com'
        GITOPS_REPO      = 'https://github.com/rkvperpetual/devops-crud-app-gitops.git'
        GITOPS_BRANCH    = 'main'
        VALUES_FILE      = 'helm/devops-task-manager/values.yaml'
    }

    stages {

        stage('Checkout Application') {
            steps {
                checkout scm

                script {
                    def commit = sh(
                        script: 'git rev-parse --short=7 HEAD',
                        returnStdout: true
                    ).trim()

                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${commit}"
                    env.IMAGE_URI = "${env.ECR_REGISTRY}/${env.ECR_REPOSITORY}:${env.IMAGE_TAG}"

                    echo "Building image: ${env.IMAGE_URI}"
                }
            }
        }

        stage('Validate Application') {
            steps {
                sh '''
                    set -eu

                    test -f app.py
                    test -f Dockerfile
                    test -f requirements.txt

                    python3 -m py_compile app.py

                    echo "Application source validation passed"
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    set -eu

                    docker build -t "$IMAGE_URI" .

                    echo "Docker image built successfully"
                '''
            }
        }

        stage('Smoke Test') {
            steps {
                sh '''
                    set -eu

                    CONTAINER_NAME="crud-smoke-${BUILD_NUMBER}"

                    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

                    cleanup() {
                        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
                    }

                    trap cleanup EXIT

                    docker run -d \
                        --name "$CONTAINER_NAME" \
                        -p 127.0.0.1:18080:5000 \
                        -e DB_PATH=/tmp/tasks.db \
                        "$IMAGE_URI"

                    for i in $(seq 1 30); do
                        if curl -fsS http://127.0.0.1:18080/healthz; then
                            echo "Application health check passed"
                            exit 0
                        fi

                        sleep 2
                    done

                    echo "Application health check failed"
                    docker logs "$CONTAINER_NAME"
                    exit 1
                '''
            }
        }

        stage('Push Image to ECR') {
            steps {
                sh '''
                    set -eu

                    aws ecr get-login-password \
                        --region "$AWS_REGION" \
                    | docker login \
                        --username AWS \
                        --password-stdin "$ECR_REGISTRY"

                    docker push "$IMAGE_URI"

                    docker logout "$ECR_REGISTRY"

                    echo "Image pushed to ECR"
                '''
            }
        }

        stage('Update GitOps Repository') {
            steps {
                dir('gitops') {
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: "*/${GITOPS_BRANCH}"]],
                        userRemoteConfigs: [[
                            url: "${GITOPS_REPO}",
                            credentialsId: 'github-token'
                        ]]
                    ])

                    sh '''
                        set -eu

                        VALUES_FILE="helm/devops-task-manager/values.yaml"

                        test -f "$VALUES_FILE"

                        sed -i -E \
                          "s|^  tag: \\".*\\"$|  tag: \\"${IMAGE_TAG}\\"|" \
                          "$VALUES_FILE"

                        grep -F "  tag: \\"${IMAGE_TAG}\\"" "$VALUES_FILE"

                        git config user.name "Jenkins CI"
                        git config user.email "jenkins@example.local"

                        if git diff --quiet -- "$VALUES_FILE"; then
                            echo "No GitOps change required"
                            exit 0
                        fi

                        git add "$VALUES_FILE"

                        git commit -m "Deploy application image ${IMAGE_TAG}"
                    '''

                    withCredentials([
                        usernamePassword(
                            credentialsId: 'github-token',
                            usernameVariable: 'GITHUB_USER',
                            passwordVariable: 'GITHUB_TOKEN'
                        )
                    ]) {
                        sh '''
                            set +x
                            set -eu

                            ASKPASS="$WORKSPACE/.git-askpass.sh"

                            cat > "$ASKPASS" <<'EOF'
#!/bin/sh
case "$1" in
    *Username*) printf '%s\\n' "$GITHUB_USER" ;;
    *Password*) printf '%s\\n' "$GITHUB_TOKEN" ;;
    *) exit 1 ;;
esac
EOF

                            chmod 700 "$ASKPASS"

                            GIT_ASKPASS="$ASKPASS" \
                            GIT_TERMINAL_PROMPT=0 \
                            git -c credential.helper= push origin HEAD:main

                            rm -f "$ASKPASS"

                            echo "GitOps repository updated"
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo "CI/CD pipeline completed successfully. ArgoCD should reconcile the new image."
        }

        failure {
            echo "Pipeline failed. Check the failed stage in the Jenkins console output."
        }
    }
}
