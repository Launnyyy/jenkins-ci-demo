pipeline {
  agent any

  tools {
    nodejs "Node18"   // must match the name in Manage Jenkins → Global Tool Configuration
  }

  environment {
    DOCKERHUB_CREDENTIALS_ID = 'dockerhub-creds'
    DOCKERHUB_REPO           = 'ujjwal882/ci-demo-app'   // ✅ updated with your DockerHub username
    IMAGE_TAG                = "${env.GIT_COMMIT}"
    SONARQUBE_ENV            = 'SonarQubeServer'
    SONAR_PROJECT_KEY        = 'ci-demo-app'             // ✅ make sure this exists in SonarQube
  }

  options {
    timestamps()
    ansiColor('xterm')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'node -v || true'
        sh 'npm -v || true'
        sh 'docker -v || true'
      }
    }

    stage('Install & Test') {
      steps {
        sh '''
          npm ci || npm install
          npx jest --ci --coverage
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: '**/junit*.xml'
          archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
        }
      }
    }

    stage('Code Quality') {
      steps {
        withSonarQubeEnv("${SONARQUBE_ENV}") {
          withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
            sh '''
              npx sonar-scanner \
                -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                -Dsonar.sources=. \
                -Dsonar.exclusions=**/node_modules/**,**/*.test.js \
                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                -Dsonar.login=$SONAR_TOKEN
            '''
          }
        }
      }
    }

    stage('Quality Gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Build Image') {
      steps {
        sh '''
          docker build -t ${DOCKERHUB_REPO}:${IMAGE_TAG} -t ${DOCKERHUB_REPO}:latest .
        '''
      }
    }

    stage('Security Scan') {
      steps {
        sh '''
          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image \
            --exit-code 1 --severity CRITICAL,HIGH \
            ${DOCKERHUB_REPO}:${IMAGE_TAG} || {
              echo "Trivy found CRITICAL/HIGH vulnerabilities."
              exit 1
            }
        '''
      }
    }

    stage('Deploy to Staging') {
      steps {
        sh '''
          IMAGE_TAG=${IMAGE_TAG} docker compose -f docker-compose.staging.yml up -d
          sleep 5
          curl -fsS http://localhost:8081/health
        '''
      }
    }

    stage('Release to Prod') {
      steps {
        input message: 'Promote to production?', ok: 'Release'
        withCredentials([usernamePassword(credentialsId: "${DOCKERHUB_CREDENTIALS_ID}", usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
            docker push ${DOCKERHUB_REPO}:${IMAGE_TAG}
            docker push ${DOCKERHUB_REPO}:latest
          '''
        }
        sh '''
          IMAGE_TAG=${IMAGE_TAG} docker compose -f docker-compose.prod.yml up -d
          sleep 8
          curl -fsS http://localhost:8080/health
        '''
      }
    }

    stage('Monitoring & Alert') {
      steps {
        sh '''
          curl -fsS http://localhost:8080/health || exit 1
        '''
      }
    }
  }

  post {
    always {
      sh 'docker images | head -n 20 || true'
    }
  }
}
