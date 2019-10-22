"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const github = __importStar(require("@actions/github"));
const io = __importStar(require("@actions/io"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const packageName = core.getInput("package-name");
            const ros2WorkspaceDir = "/opt/ros2_ws";
            yield exec.exec("rosdep", ["update"]);
            // Checkout ROS 2 from source and install ROS 2 system dependencies
            yield io.mkdirP(ros2WorkspaceDir + "/src");
            const options = {
                cwd: ros2WorkspaceDir
            };
            yield exec.exec("bash", ["-c",
                "curl https://raw.githubusercontent.com/ros2/ros2/master/ros2.repos | vcs import src/"], options);
            // The repo file for the repository needs to be generated on-the-fly to
            // incorporate the custom repository URL and branch name, when a PR is
            // being built.
            const repo = github.context.repo;
            const headRef = process.env.GITHUB_HEAD_REF;
            const commitRef = headRef || github.context.sha;
            yield exec.exec("bash", ["-c", `vcs import src/ << EOF
repositories:
  ${packageName}:
    type: git
    url: "https://github.com/${repo["owner"]}/${repo["repo"]}.git"
    version: "${commitRef}"
EOF`], options);
            // Remove all repositories the package under test does not depend on, to
            // avoid having rosdep installing unrequired dependencies.
            yield exec.exec("bash", ["-c",
                `diff --new-line-format="" --unchanged-line-format="" <(colcon list -p) <(colcon list --packages-up-to ${packageName} -p) | xargs rm -rf`], options);
            // For "latest" builds, rosdep often misses some keys, adding "|| true", to
            // ignore those failures, as it is often non-critical.
            yield exec.exec("bash", ["-c", "DEBIAN_FRONTEND=noninteractive RTI_NC_LICENSE_ACCEPTED=yes rosdep install -r --from-paths src --ignore-src --rosdistro eloquent -y || true"], options);
            yield exec.exec("colcon", ["build", "--event-handlers", "console_cohesion+", "--packages-up-to",
                packageName, "--symlink-install"], options);
            yield exec.exec("colcon", ["test", "--event-handlers", "console_cohesion+", "--packages-select",
                packageName, "--return-code-on-test-failure"], options);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();