#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create timestamp for backups
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}=== Solana Token Sniper Development Workflow ===${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to backup important files
backup_project() {
    echo -e "\n${BLUE}Creating backup...${NC}"
    
    # Create backups directory if it doesn't exist
    mkdir -p ./backups/features

    # Backup important files
    cp .env "./backups/features/.env.${TIMESTAMP}" 2>/dev/null || echo -e "${RED}No .env file to backup${NC}"
    cp src/config.ts "./backups/features/config.ts.${TIMESTAMP}" 2>/dev/null || echo -e "${RED}No config.ts to backup${NC}"
    cp src/tracker/holdings.db "./backups/features/holdings.db.${TIMESTAMP}" 2>/dev/null || echo -e "${RED}No holdings.db to backup${NC}"
    
    # Backup all source files
    mkdir -p "./backups/features/src.${TIMESTAMP}"
    cp -r src/* "./backups/features/src.${TIMESTAMP}/" 2>/dev/null || echo -e "${RED}No source files to backup${NC}"
    
    echo -e "${GREEN}Backup created with timestamp: ${TIMESTAMP}${NC}"
    echo $TIMESTAMP > ./backups/features/last_backup
}

# Function to restore from backup
restore_backup() {
    echo -e "\n${BLUE}Available backups:${NC}"
    ls -1 ./backups/features | grep "src\." | sed 's/src\.\(.*\)/\1/'
    
    echo -e "\nEnter timestamp to restore (e.g., 20240101_120000) or 'cancel':"
    read -r restore_timestamp
    
    if [ "$restore_timestamp" = "cancel" ]; then
        echo "Restore cancelled"
        return
    fi
    
    echo -e "${YELLOW}Warning: This will overwrite current files. Continue? (y/n)${NC}"
    read -r confirm
    if [ "$confirm" != "y" ]; then
        echo "Restore cancelled"
        return
    fi
    
    if [ -f "./backups/features/.env.${restore_timestamp}" ]; then
        cp "./backups/features/.env.${restore_timestamp}" .env
    fi
    if [ -f "./backups/features/config.ts.${restore_timestamp}" ]; then
        cp "./backups/features/config.ts.${restore_timestamp}" src/config.ts
    fi
    if [ -f "./backups/features/holdings.db.${restore_timestamp}" ]; then
        cp "./backups/features/holdings.db.${restore_timestamp}" src/tracker/holdings.db
    fi
    if [ -d "./backups/features/src.${restore_timestamp}" ]; then
        cp -r "./backups/features/src.${restore_timestamp}"/* src/
    fi
    
    echo -e "${GREEN}Restore completed${NC}"
}

# Function to start new feature development
start_feature() {
    echo -e "\n${BLUE}Starting new feature development${NC}"
    echo -e "Enter feature name (use-dashes-between-words):"
    read -r feature_name
    
    # Clean feature name (replace spaces with dashes and remove special characters)
    clean_feature_name=$(echo "$feature_name" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9-]//g')
    
    # Create feature branch if using git
    if [ -d .git ]; then
        # Ensure we're up to date
        echo -e "\n${BLUE}Updating main branch...${NC}"
        git checkout main
        git pull origin main
        
        # Create and checkout feature branch
        git checkout -b "feature/${clean_feature_name}"
        
        # Push branch to remote
        echo -e "\n${YELLOW}Would you like to push the branch to remote? (y/n)${NC}"
        read -r should_push
        if [ "$should_push" = "y" ]; then
            git push -u origin "feature/${clean_feature_name}"
            echo -e "${GREEN}Branch pushed to remote${NC}"
        fi
        
        echo -e "${GREEN}Created feature branch: feature/${clean_feature_name}${NC}"
    fi
    
    # Create feature backup
    backup_project
    echo "$clean_feature_name" > ./backups/features/current_feature
    
    echo -e "${GREEN}Feature development environment ready!${NC}"
    echo -e "${YELLOW}Development Workflow:${NC}"
    echo "1. Make your changes"
    echo "2. Test frequently (use options 6-8)"
    echo "3. Create backups after significant changes"
    echo "4. Commit your changes regularly:"
    echo "   git add ."
    echo "   git commit -m \"feat: your changes\""
    echo "5. Push to remote:"
    echo "   git push"
    echo "6. When done, use 'Finish feature' option"
}

# Function to finish feature development
finish_feature() {
    if [ ! -f ./backups/features/current_feature ]; then
        echo -e "${RED}No active feature development found${NC}"
        return
    fi
    
    feature_name=$(cat ./backups/features/current_feature)
    echo -e "\n${BLUE}Finishing feature: ${feature_name}${NC}"
    
    # Create final backup
    backup_project
    
    # If using git, handle final commits and PR
    if [ -d .git ]; then
        # Check for uncommitted changes
        if [[ ! -z $(git status --porcelain) ]]; then
            echo -e "\n${YELLOW}You have uncommitted changes. Would you like to commit them? (y/n)${NC}"
            read -r should_commit
            if [ "$should_commit" = "y" ]; then
                git add .
                echo -e "\nEnter commit message:"
                read -r commit_message
                git commit -m "feat: ${commit_message}"
                echo -e "${GREEN}Changes committed${NC}"
            fi
        fi
        
        # Push final changes
        echo -e "\n${YELLOW}Would you like to push final changes? (y/n)${NC}"
        read -r should_push
        if [ "$should_push" = "y" ]; then
            git push
            echo -e "${GREEN}Changes pushed to remote${NC}"
            
            # Provide PR instructions
            echo -e "\n${YELLOW}Next steps:${NC}"
            echo "1. Go to GitHub repository"
            echo "2. Click 'Compare & pull request'"
            echo "3. Fill in PR description"
            echo "4. Request review if needed"
        fi
    fi
    
    rm ./backups/features/current_feature
    echo -e "${GREEN}Feature development completed!${NC}"
}

# Check git status
check_git_status() {
    if command_exists git; then
        if [ -d .git ]; then
            echo -e "\n${BLUE}Git Status:${NC}"
            git status --short
            echo -e "\n${BLUE}Current Branch:${NC}"
            git branch | grep "*"
        else
            echo -e "${RED}Not a git repository${NC}"
        fi
    fi
}

# Main workflow
echo -e "\n${BLUE}1. Creating backup of current state...${NC}"
backup_project

echo -e "\n${BLUE}2. Checking environment...${NC}"
if [ -f "test-env.sh" ]; then
    bash test-env.sh
else
    echo -e "${RED}test-env.sh not found${NC}"
fi

echo -e "\n${BLUE}3. Checking dependencies...${NC}"
if command_exists npm; then
    npm install
else
    echo -e "${RED}npm not found. Please install Node.js${NC}"
    exit 1
fi

echo -e "\n${BLUE}4. Checking git status...${NC}"
check_git_status

# Menu
while true; do
    echo -e "\n${BLUE}Available commands:${NC}"
    echo -e "${YELLOW}Development:${NC}"
    echo "1. Start new feature"
    echo "2. Create development backup"
    echo "3. Restore from backup"
    echo "4. Finish feature"
    echo "5. Check git status"
    echo -e "\n${YELLOW}Testing:${NC}"
    echo "6. Start bot (npm run dev)"
    echo "7. Start tracker (npm run tracker)"
    echo "8. Run environment tests"
    echo -e "\n${YELLOW}System:${NC}"
    echo "9. Exit"
    
    read -p "Enter command number: " cmd
    
    case $cmd in
        1) start_feature ;;
        2) backup_project ;;
        3) restore_backup ;;
        4) finish_feature ;;
        5) check_git_status ;;
        6) npm run dev ;;
        7) npm run tracker ;;
        8) bash test-env.sh ;;
        9) 
            echo -e "${GREEN}Exiting...${NC}"
            exit 0
            ;;
        *) echo -e "${RED}Invalid command${NC}" ;;
    esac
done 